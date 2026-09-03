"""
Module: Gemini Model Manager & Multi-Model Token Rotator
---------------------------------------------------------
Chức năng:
1. Lấy danh sách model public hiện tại từ Google Gemini API:
   GET https://generativelanguage.googleapis.com/v1beta/models?key={api_key}
2. Tự động xếp hạng ưu tiên (Pro > Flash > Flash-Lite/8B; 2.5 > 2.0 > 1.5).
3. Cơ chế Sticky Fallback:
   - Luôn dùng model cao nhất hiện tại.
   - Nếu không hết token/quota: Cứ tiếp tục dùng model hiện tại.
   - Khi bị lỗi quota (429 / RESOURCE_EXHAUSTED): Tự động xoay sang model ưu tiên kế tiếp!
   - Hỗ trợ xoay vòng (round-robin) cả model và nhiều API Key (nếu có).
"""

import os
import sys
import re
import json
import base64
import urllib.request
import urllib.error
from typing import List, Dict, Optional, Tuple, Any
from pathlib import Path

# Đảm bảo UTF-8 console output trên Windows
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass


class GeminiModelManager:
    """Quản lý danh sách model và tự động xoay model khi chạm giới hạn token."""

    BASE_URL = "https://generativelanguage.googleapis.com/v1beta"

    def __init__(self, api_keys: Optional[List[str]] = None):
        """
        Khởi tạo với 1 hoặc nhiều API keys.
        Có thể lấy từ biến môi trường GEMINI_API_KEY hoặc GEMINI_API_KEYS.
        """
        if isinstance(api_keys, str):
            api_keys = [k.strip() for k in api_keys.split(",") if k.strip()]
        elif not api_keys:
            env_key = os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI_API_KEYS") or ""
            api_keys = [k.strip() for k in env_key.split(",") if k.strip()]

        self.api_keys: List[str] = api_keys or []
        self.current_key_index: int = 0
        self.available_models: List[Dict[str, Any]] = []
        self.current_model_index: int = 0
        self.is_initialized: bool = False

    @property
    def current_api_key(self) -> str:
        if not self.api_keys:
            return ""
        return self.api_keys[self.current_key_index]

    @property
    def current_model_name(self) -> str:
        if not self.available_models:
            return "gemini-1.5-flash"  # default fallback
        return self.available_models[self.current_model_index]["clean_name"]

    def add_api_key(self, api_key: str):
        if api_key and api_key not in self.api_keys:
            self.api_keys.append(api_key.strip())

    # ─────────────────────────────────────────────────────────────
    # 1. LẤY DANH SÁCH MODEL TỪ PUBLIC API CỦA GEMINI
    # ─────────────────────────────────────────────────────────────

    def fetch_public_models(self, api_key: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Gọi API public của Gemini để lấy danh sách model thực tế hiện hành:
        GET https://generativelanguage.googleapis.com/v1beta/models?key=...
        """
        key = api_key or self.current_api_key
        if not key:
            print("⚠️ Chưa cung cấp Gemini API Key. Dùng danh sách fallback tiêu chuẩn.")
            return self._get_fallback_ranked_models()

        url = f"{self.BASE_URL}/models?key={key}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "MXV-GeminiRotator/1.0"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                raw_models = data.get("models", [])
                ranked = self._filter_and_rank_models(raw_models)
                self.available_models = ranked
                self.is_initialized = True
                return ranked
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="ignore")
            print(f"❌ Lỗi HTTP khi lấy danh sách model Gemini ({e.code}): {err_body}")
        except Exception as e:
            print(f"❌ Lỗi kết nối Gemini Public API: {e}")

        # Fallback nếu gọi mạng thất bại
        return self._get_fallback_ranked_models()

    def _filter_and_rank_models(self, raw_models: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Lọc các model hỗ trợ generateContent (text/vision)
        và sắp xếp theo thứ tự ưu tiên:
        Cao nhất (Pro) -> Tầm trung (Flash) -> Nhẹ (Flash-Lite / Flash-8B)
        Thế hệ 2.5 > 2.0 > 1.5
        """
        valid_models = []

        for m in raw_models:
            name = m.get("name", "")  # e.g. "models/gemini-1.5-flash"
            methods = m.get("supportedGenerationMethods", [])

            # Bắt buộc phải hỗ trợ generateContent
            if "generateContent" not in methods:
                continue

            clean_name = name.replace("models/", "")

            # Bỏ qua các model embedding, aqa, tts, imagen
            lower_name = clean_name.lower()
            if any(bad in lower_name for bad in ["embedding", "aqa", "imagen", "tts", "learnlm"]):
                continue

            score = self._calculate_model_score(clean_name, m)
            valid_models.append({
                "name": name,
                "clean_name": clean_name,
                "displayName": m.get("displayName", clean_name),
                "description": m.get("description", ""),
                "inputTokenLimit": m.get("inputTokenLimit", 0),
                "outputTokenLimit": m.get("outputTokenLimit", 0),
                "priority_score": score,
            })

        # Sắp xếp theo score giảm dần (cao nhất đứng đầu)
        valid_models.sort(key=lambda x: x["priority_score"], reverse=True)
        return valid_models

    @staticmethod
    def _calculate_model_score(model_name: str, meta: Dict[str, Any]) -> int:
        """
        Tính điểm năng lực của model để xếp hạng ưu tiên:
        - 2.5 > 2.0 > 1.5
        - Pro > Flash > Flash-Lite / 8B
        - Experimental có thể cao nhưng bản stable được cộng điểm ổn định
        """
        score = 0
        name = model_name.lower()

        # Thế hệ (Generation)
        if "3.8" in name:
            score += 4800
        elif "3.7" in name:
            score += 4700
        elif "3.6" in name:
            score += 4600
        elif "3.5" in name:
            score += 4500
        elif "3.1" in name:
            score += 4100
        elif "3.0" in name or "gemini-3-" in name:
            score += 4000
        elif "2.5" in name:
            score += 3000
        elif "2.0" in name:
            score += 2000
        elif "1.5" in name:
            score += 1000
        elif "1.0" in name:
            score += 500

        # Phân cấp (Tier)
        if "pro" in name or "ultra" in name:
            score += 600
        elif "flash-lite" in name or "8b" in name:
            score += 100
        elif "flash" in name:
            score += 300

        # Ưu tiên model chính thức hơn bản preview/exp nếu cùng cấp
        if "exp" in name or "preview" in name:
            score -= 50

        # Ưu tiên context window lớn (thường Pro có inputTokenLimit 1M-2M)
        token_limit = meta.get("inputTokenLimit", 0)
        if token_limit >= 2000000:
            score += 100
        elif token_limit >= 1000000:
            score += 50

        return score

    def _get_fallback_ranked_models(self) -> List[Dict[str, Any]]:
        """Danh sách ưu tiên mặc định khi chưa gọi được API hoặc offline."""
        defaults = [
            {"clean_name": "gemini-2.5-pro", "displayName": "Gemini 2.5 Pro", "priority_score": 3600},
            {"clean_name": "gemini-2.0-pro-exp-02-05", "displayName": "Gemini 2.0 Pro Experimental", "priority_score": 2550},
            {"clean_name": "gemini-1.5-pro", "displayName": "Gemini 1.5 Pro", "priority_score": 1650},
            {"clean_name": "gemini-2.5-flash", "displayName": "Gemini 2.5 Flash", "priority_score": 3300},
            {"clean_name": "gemini-2.0-flash", "displayName": "Gemini 2.0 Flash", "priority_score": 2300},
            {"clean_name": "gemini-1.5-flash", "displayName": "Gemini 1.5 Flash", "priority_score": 1350},
            {"clean_name": "gemini-2.0-flash-lite-preview-02-05", "displayName": "Gemini 2.0 Flash Lite", "priority_score": 2050},
            {"clean_name": "gemini-1.5-flash-8b", "displayName": "Gemini 1.5 Flash 8B", "priority_score": 1100},
        ]
        defaults.sort(key=lambda x: x["priority_score"], reverse=True)
        self.available_models = defaults
        self.is_initialized = True
        return defaults

    # ─────────────────────────────────────────────────────────────
    # 2. CƠ CHẾ XOAY VÒNG MODEL KHI HẾT TOKEN (STICKY ROTATION)
    # ─────────────────────────────────────────────────────────────

    def rotate_to_next_model(self, reason: str = "Quota/Rate Limit"):
        """
        Xoay sang model ưu tiên kế tiếp khi model hiện tại hết quota.
        Nếu đã duyệt hết danh sách model, thử xoay sang API Key kế tiếp (nếu có).
        """
        if not self.available_models:
            return

        old_model = self.current_model_name
        self.current_model_index = (self.current_model_index + 1) % len(self.available_models)
        new_model = self.current_model_name

        print(f"\n🔄 [XOAY MODEL] {old_model} bị {reason}.")
        print(f"👉 Chuyển sang model tiếp theo: {new_model} (Thứ hạng: {self.current_model_index + 1}/{len(self.available_models)})")

        # Nếu đã quay lại model đầu tiên và có nhiều API key -> xoay API key
        if self.current_model_index == 0 and len(self.api_keys) > 1:
            self.current_key_index = (self.current_key_index + 1) % len(self.api_keys)
            print(f"🔑 [XOAY API KEY] Đã duyệt hết tất cả model. Đổi sang API Key #{self.current_key_index + 1}")

    def generate_content_with_retry(
        self,
        prompt: str,
        image_bytes_list: Optional[List[Tuple[str, bytes]]] = None,
        max_attempts: int = 6,
        temperature: float = 0.1,
    ) -> Optional[str]:
        """
        Gọi generateContent với cơ chế Sticky Model:
        - Dùng model hiện tại.
        - Thành công: GIỮ NGUYÊN model này cho lần sau.
        - Thất bại do Quota/429: XOAY sang model tiếp theo và thử lại ngay lập tức.
        """
        if not self.is_initialized:
            self.fetch_public_models()

        if not self.api_keys:
            raise ValueError("Chưa cấu hình GEMINI_API_KEY. Vui lòng set biến môi trường hoặc truyền vào.")

        attempts = 0
        while attempts < max_attempts:
            attempts += 1
            model = self.current_model_name
            key = self.current_api_key

            url = f"{self.BASE_URL}/models/{model}:generateContent?key={key}"

            # Xây dựng contents payload
            parts: List[Dict[str, Any]] = [{"text": prompt}]

            if image_bytes_list:
                for mime_type, img_data in image_bytes_list:
                    b64 = base64.b64encode(img_data).decode("utf-8")
                    parts.append({
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": b64
                        }
                    })

            payload = {
                "contents": [{"parts": parts}],
                "generationConfig": {
                    "temperature": temperature,
                    "responseMimeType": "application/json" if "json" in prompt.lower() else "text/plain"
                }
            }

            req_data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=req_data,
                headers={"Content-Type": "application/json", "User-Agent": "MXV-GeminiRotator/1.0"}
            )

            try:
                with urllib.request.urlopen(req, timeout=30) as resp:
                    resp_json = json.loads(resp.read().decode("utf-8"))
                    candidates = resp_json.get("candidates", [])
                    if candidates:
                        text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                        # THÀNH CÔNG: Giữ nguyên model hiện tại!
                        return text.strip()
                    else:
                        print(f"⚠️ Response không có candidates từ model {model}: {resp_json}")

            except urllib.error.HTTPError as e:
                err_body = e.read().decode("utf-8", errors="ignore")
                is_quota_error = (
                    e.code == 429
                    or "RESOURCE_EXHAUSTED" in err_body
                    or "quota" in err_body.lower()
                    or "rate limit" in err_body.lower()
                )

                if is_quota_error:
                    print(f"⚠️ Model {model} chạm giới hạn Token/Quota (HTTP 429).")
                    self.rotate_to_next_model(reason="Hết Token/Quota (HTTP 429)")
                    continue  # thử lại với model mới
                elif e.code == 404:
                    print(f"⚠️ Model {model} không hỗ trợ generateContent hoặc không tồn tại (HTTP 404).")
                    self.rotate_to_next_model(reason="Model 404 Not Found")
                    continue
                else:
                    print(f"❌ Lỗi HTTP {e.code} từ {model}: {err_body[:200]}")
                    self.rotate_to_next_model(reason=f"HTTP {e.code}")
                    continue

            except Exception as e:
                print(f"❌ Ngoại lệ khi gọi {model}: {e}")
                self.rotate_to_next_model(reason=str(e))
                continue

        print(f"❌ Đã thử {max_attempts} lần qua các model nhưng đều không thành công.")
        return None

    # ─────────────────────────────────────────────────────────────
    # 3. CHỨC NĂNG OCR CCCD BẰNG GEMINI VISION
    # ─────────────────────────────────────────────────────────────

    def extract_cccd(self, truoc_path: Optional[str], sau_path: Optional[str]) -> Optional[Dict[str, Any]]:
        """
        Trích xuất thông tin CCCD từ 1 hoặc 2 ảnh (mặt trước + mặt sau).
        Tự động trả về JSON chuẩn xác.
        """
        images: List[Tuple[str, bytes]] = []

        for p in [truoc_path, sau_path]:
            if p and os.path.exists(p):
                ext = Path(p).suffix.lower()
                mime = "image/jpeg" if ext in [".jpg", ".jpeg"] else "image/png"
                with open(p, "rb") as f:
                    images.append((mime, f.read()))

        if not images:
            print("❌ Không có file ảnh CCCD nào để đọc.")
            return None

        prompt = """
Bạn là hệ thống trích xuất thông tin Căn Cước Công Dân (CCCD) Việt Nam của Sở Giao Dịch Hàng Hóa Việt Nam (MXV).
Nhiệm vụ: Trích xuất chính xác 100% dữ liệu từ ảnh mặt trước và/hoặc mặt sau của CCCD.

Hãy trả về DUY NHẤT một chuỗi JSON hợp lệ với cấu trúc sau (nếu không đọc được trường nào hãy để null):
{
  "soCCCD": "12 số định danh cá nhân",
  "soCMNDCu": "9 số CMND cũ (nếu có trên mã QR hoặc mặt trước)",
  "hoTen": "Họ và tên đầy đủ viết hoa có dấu",
  "hoTenKhongDau": "Họ và tên không dấu (từ dòng MRZ mặt sau)",
  "ngaySinh": "DD/MM/YYYY",
  "gioiTinh": "Nam hoặc Nữ",
  "queQuan": "Quê quán",
  "diaChi": "Nơi thường trú",
  "ngayCap": "DD/MM/YYYY",
  "noiCap": "Nơi cấp (ví dụ: Cục Cảnh sát Quản lý hành chính về trật tự xã hội)",
  "ngayHetHan": "DD/MM/YYYY (hoặc null nếu vô thời hạn)",
  "mrzLine1": "Dòng 1 của mã máy đọc MRZ mặt sau nếu có",
  "mrzLine2": "Dòng 2 của mã máy đọc MRZ mặt sau nếu có",
  "mrzLine3": "Dòng 3 của mã máy đọc MRZ mặt sau nếu có"
}
Lưu ý:
- Chỉ xuất duy nhất định dạng JSON, không có văn bản giải thích.
- Kiểm tra chéo giữa số CCCD mặt trước và dãy số ở dòng MRZ mặt sau để đảm bảo không bị nhầm lẫn số 0 và O, 1 và I.
"""
        raw_res = self.generate_content_with_retry(prompt, image_bytes_list=images)
        if not raw_res:
            return None

        # Clean JSON markdown if wrapped in ```json ... ```
        cleaned = re.sub(r"^```(?:json)?\s*", "", raw_res.strip())
        cleaned = re.sub(r"\s*```$", "", cleaned)

        try:
            return json.loads(cleaned)
        except Exception as e:
            print(f"❌ Lỗi parse JSON từ Gemini response: {e}\nRaw: {raw_res[:200]}")
            return None


# ─────────────────────────────────────────────────────────────
# CLI TEST TIỆN ÍCH
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Gemini Model Manager & Public API Inspector")
    parser.add_argument("--key", help="Gemini API Key")
    parser.add_argument("--list", action="store_true", help="Lấy và in ra danh sách model public theo thứ tự ưu tiên")
    parser.add_argument("--test-prompt", help="Thử gọi prompt với cơ chế sticky rotation")
    args = parser.parse_args()

    manager = GeminiModelManager(api_keys=args.key)
    print("=" * 60)
    print("🔍 GEMINI PUBLIC API MODEL INSPECTOR & ROTATOR")
    print("=" * 60)

    models = manager.fetch_public_models()
    print(f"\n✅ Đã tìm thấy và xếp hạng {len(models)} models:")
    print(f"{'STT':<4} | {'Clean Model Name':<32} | {'Score':<6} | {'DisplayName'}")
    print("-" * 75)
    for idx, m in enumerate(models, 1):
        print(f"{idx:<4} | {m['clean_name']:<32} | {m['priority_score']:<6} | {m.get('displayName', '')}")

    print(f"\n🎯 Model ưu tiên cao nhất đang được chọn: {manager.current_model_name}")

    if args.test_prompt:
        print(f"\n🚀 Đang test prompt: '{args.test_prompt}' trên model: {manager.current_model_name}")
        ans = manager.generate_content_with_retry(args.test_prompt)
        print(f"\n💡 Kết quả:\n{ans}")
