const https = require('https');

const webhookUrl = 'https://defaultb83638b233124ed384ddfcc24c5d76.a2.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/04/workflows/7068e1069abd48feb0d6e722230bc166/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=1K48tCD9J0FrRZIdmYMUvYqia6cecurn1YOClzvp5Sk';

// Send Adaptive Card directly at the root level of the payload
const payload = {
  type: "AdaptiveCard",
  body: [
    {
      type: "TextBlock",
      size: "large",
      weight: "bolder",
      text: "🚨 CẢNH BÁO ĐÁO HẠN HỢP ĐỒNG - TV079",
      color: "attention"
    },
    {
      type: "TextBlock",
      text: "Chào bộ phận QLGD và Thành viên 079,\nDưới đây là danh sách các hợp đồng sắp đáo hạn nhưng **không cho phép giao nhận thực tế**. Vui lòng kiểm tra và tất toán vị thế trước ngày thông báo đầu tiên (FND).",
      wrap: true
    },
    {
      type: "FactSet",
      facts: [
        {
          "title": "Mã Hợp Đồng",
          "value": "ZWAZCE (Lúa mỳ Chicago)"
        },
        {
          "title": "Tháng đáo hạn",
          "value": "Tháng 09/2026 (ZWAU26)"
        },
        {
          "title": "Ngày đáo hạn",
          "value": "17/07/2026"
        },
        {
          "title": "Loại tài khoản",
          "value": "Tài khoản thường (Không giao nhận)"
        }
      ]
    },
    {
      type: "TextBlock",
      text: "⚠️ **Lưu ý:** Nếu không tất toán trước thời hạn, hệ thống sẽ tự động đóng vị thế cưỡng bức theo quy định của Sở Giao dịch Hàng hóa Việt Nam (MXV).",
      wrap: true,
      weight: "lighter",
      isSubtle: true
    }
  ],
  $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
  version: "1.2"
};

const data = JSON.stringify(payload);

const url = new URL(webhookUrl);
const options = {
  hostname: url.hostname,
  port: url.port || 443,
  path: url.pathname + url.search,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

console.log('Đang gửi trực tiếp Adaptive Card (không bọc body) đến Microsoft Teams...');

const req = https.request(options, (res) => {
  let responseData = '';
  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log(`Mã phản hồi từ Teams: ${res.statusCode}`);
    console.log(`Nội dung phản hồi: ${responseData}`);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log('✅ Gửi tin nhắn test THÀNH CÔNG!');
    } else {
      console.log('❌ Gửi tin nhắn test THẤT BẠI!');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Lỗi kết nối:', error);
});

req.write(data);
req.end();
