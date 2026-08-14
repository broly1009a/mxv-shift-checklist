from __future__ import annotations

import math
import re
import unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlencode
import urllib.request
from apscheduler.schedulers.background import BackgroundScheduler

import pandas as pd
from flask import Flask, render_template_string, request

BASE_DIR = Path(__file__).resolve().parent

app = Flask(__name__, static_folder=str(BASE_DIR), static_url_path='/static')

EU_DATA_FILE = BASE_DIR / "data.csv"
UN_XML_FILE = BASE_DIR / "consolidatedLegacyByNAME.xml"
OFAC_SDN_FILE = BASE_DIR / "sdn.csv"
OFAC_ADD_FILE = BASE_DIR / "add.csv"  
PAGE_SIZE = 25

RECORDS: list[dict[str, str]] = []


def update_sanction_files():
    """Tải và ghi đè dữ liệu mới nhất từ các nguồn EU, UN, OFAC; sau đó load lại vào bộ nhớ."""
    global RECORDS
    
    BASE_DIR.mkdir(parents=True, exist_ok=True)

    urls = {
        EU_DATA_FILE: "https://webgate.ec.europa.eu/europeaid/fsd/fsf/public/files/csvFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw",
        UN_XML_FILE: "https://scsanctions.un.org/resources/xml/en/consolidated.xml",
        OFAC_SDN_FILE: "https://www.treasury.gov/ofac/downloads/sdn.csv",
        OFAC_ADD_FILE: "https://www.treasury.gov/ofac/downloads/add.csv"  # Tải thêm file địa chỉ OFAC
    }
    
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}

    print("\n[Hệ thống] Đang kiểm tra và tải cập nhật dữ liệu từ các nguồn...")
    for file_path, url in urls.items():
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req) as response, open(file_path, 'wb') as out_file:
                out_file.write(response.read())
            print(f" -> Tải thành công & đã ghi đè: {file_path.name}")
        except Exception as e:
            print(f" -> Lỗi khi tải {file_path.name}: {e}")

    try:
        RECORDS = load_records()
        print(f"[Hệ thống] Đã nạp xong {len(RECORDS)} hồ sơ mới nhất vào hệ thống!\n")
    except Exception as e:
        print(f"[Hệ thống] Lỗi khi nạp dữ liệu: {e}\n")


SOURCE_OPTIONS = [
    ("", "Tất cả nguồn"),
    ("EU", "EU"),
    ("UN", "UN"),
    ("OFAC", "OFAC"),
]

SEARCH_FIELDS = [
    {"name": "keyword", "label": "Từ khóa", "type": "text", "placeholder": "Tên, alias, remarks, reference..."},
    {"name": "source", "label": "Nguồn", "type": "select", "options": SOURCE_OPTIONS},
    {"name": "entity_id", "label": "ID", "type": "text", "placeholder": "ID nội bộ theo từng nguồn"},
    {"name": "reference", "label": "Reference", "type": "text", "placeholder": "EU ref / UN ref / OFAC number"},
    {"name": "whole_name", "label": "Tên đối tượng", "type": "text", "placeholder": "Tên đầy đủ"},
    {"name": "country", "label": "Quốc gia", "type": "text", "placeholder": "Nationality / country / flag"},
    {"name": "city", "label": "Thành phố", "type": "text", "placeholder": "City / place of birth"},
    {"name": "birth_year", "label": "Năm sinh", "type": "text", "placeholder": "Ví dụ: 1973"},
    {"name": "subject_type", "label": "Loại đối tượng", "type": "text", "placeholder": "person / entity / vessel / aircraft"},
    {"name": "programme", "label": "Programme/List", "type": "text", "placeholder": "IRQ / SDGT / Al-Qaida..."},
]

DETAIL_FIELDS = [
    ("source", "Nguồn"),
    ("entity_id", "ID"),
    ("reference", "Reference"),
    ("whole_name", "Tên đầy đủ"),
    ("aliases", "Bí danh"),
    ("subject_type", "Loại"),
    ("programme", "Programme/List"),
    ("country", "Quốc gia"),
    ("city", "Thành phố"),
    ("birth_year", "Năm sinh"),
    ("listed_on", "Listed on"),
    ("functions", "Chức vụ/Title"),
    ("designation_details", "Designation"),
    ("remarks", "Remarks"),
]

OFAC_COLUMNS = [
    "ent_num",
    "name",
    "subject_type",
    "programme",
    "title",
    "call_sign",
    "vessel_type",
    "tonnage",
    "gross_tonnage",
    "vessel_flag",
    "vessel_owner",
    "remarks",
]


def normalize_text(value: str) -> str:
    value = (value or "").strip()
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch)).casefold()


def split_values(raw_value: object) -> list[str]:
    parts = [part.strip() for part in str(raw_value or "").replace("|", ";").split(";")]
    seen = set()
    values = []
    for part in parts:
        if not part or part == "-0-":
            continue
        key = normalize_text(part)
        if key in seen:
            continue
        seen.add(key)
        values.append(part)
    return values


def compact_join(values: list[str], limit: int = 6) -> str:
    if not values:
        return ""
    if len(values) <= limit:
        return ", ".join(values)
    return ", ".join(values[:limit]) + f" +{len(values) - limit}"


def unique_values(values: list[object]) -> list[str]:
    seen = set()
    results = []
    for raw_value in values:
        for value in split_values(raw_value):
            key = normalize_text(value)
            if key in seen:
                continue
            seen.add(key)
            results.append(value)
    return results


def first_non_empty(values: list[object]) -> str:
    items = unique_values(values)
    return items[0] if items else ""


def extract_years(*values: object) -> list[str]:
    years = []
    seen = set()
    for value in values:
        for year in re.findall(r"(?:19|20)\d{2}", str(value or "")):
            if year in seen:
                continue
            seen.add(year)
            years.append(year)
    return years


def text_of(node: ET.Element | None, tag: str) -> str:
    if node is None:
        return ""
    child = node.find(tag)
    return (child.text or "").strip() if child is not None and child.text else ""


def texts_of(node: ET.Element | None, path: str) -> list[str]:
    if node is None:
        return []
    return unique_values([(child.text or "").strip() for child in node.findall(path)])


def build_record(
    *,
    source: str,
    entity_id: str,
    reference: str = "",
    whole_name: str = "",
    aliases: list[str] | None = None,
    subject_type: str = "",
    programme: str = "",
    country: list[str] | None = None,
    city: list[str] | None = None,
    birth_year: list[str] | None = None,
    listed_on: str = "",
    functions: list[str] | None = None,
    designation_details: list[str] | None = None,
    remarks: list[str] | None = None,
    extra_values: list[object] | None = None,
) -> dict[str, str]:
    aliases = unique_values(aliases or [])
    country = unique_values(country or [])
    city = unique_values(city or [])
    birth_year = unique_values(birth_year or [])
    functions = unique_values(functions or [])
    designation_details = unique_values(designation_details or [])
    remarks = unique_values(remarks or [])
    all_text_parts = [
        source,
        entity_id,
        reference,
        whole_name,
        subject_type,
        programme,
        *aliases,
        *country,
        *city,
        *birth_year,
        *functions,
        *designation_details,
        *remarks,
        *(extra_values or []),
    ]
    return {
        "source": source,
        "entity_id": entity_id,
        "reference": reference,
        "whole_name": whole_name or compact_join(aliases, 1) or entity_id,
        "aliases": compact_join(aliases, 8),
        "subject_type": subject_type,
        "programme": programme,
        "country": compact_join(country, 4),
        "city": compact_join(city, 4),
        "birth_year": compact_join(birth_year, 4),
        "listed_on": listed_on,
        "functions": compact_join(functions, 6),
        "designation_details": compact_join(designation_details, 6),
        "remarks": compact_join(remarks, 6),
        "all_text": " ".join(str(part) for part in all_text_parts if str(part).strip()),
    }


def load_eu_records() -> list[dict[str, str]]:
    if not EU_DATA_FILE.exists():
        return []
    dataframe = pd.read_csv(EU_DATA_FILE, sep=";", dtype=str, encoding="utf-8-sig").fillna("")
    dataframe["Entity_LogicalId"] = dataframe["Entity_LogicalId"].astype(str).str.strip()
    dataframe = dataframe[dataframe["Entity_LogicalId"] != ""]

    records: list[dict[str, str]] = []
    for entity_id, group_df in dataframe.groupby("Entity_LogicalId", sort=False):
        rows = group_df.to_dict(orient="records")
        aliases = unique_values(
            [row.get("NameAlias_WholeName", "") for row in rows]
            + [row.get("NameAlias_FirstName", "") for row in rows]
            + [row.get("NameAlias_MiddleName", "") for row in rows]
            + [row.get("NameAlias_LastName", "") for row in rows]
        )
        countries = unique_values(
            [row.get("Citizenship_CountryDescription", "") for row in rows]
            + [row.get("Address_CountryDescription", "") for row in rows]
            + [row.get("BirthDate_CountryDescription", "") for row in rows]
            + [row.get("Citizenship_CountryIso2Code", "") for row in rows]
            + [row.get("Address_CountryIso2Code", "") for row in rows]
            + [row.get("BirthDate_CountryIso2Code", "") for row in rows]
        )
        cities = unique_values(
            [row.get("Address_City", "") for row in rows]
            + [row.get("BirthDate_City", "") for row in rows]
            + [row.get("BirthDate_Place", "") for row in rows]
            + [row.get("Address_Place", "") for row in rows]
        )
        remarks = unique_values(
            [row.get("Entity_Remark", "") for row in rows]
            + [row.get("NameAlias_Remark", "") for row in rows]
            + [row.get("Address_Remark", "") for row in rows]
            + [row.get("BirthDate_Remark", "") for row in rows]
        )
        functions = unique_values([row.get("NameAlias_Function", "") for row in rows] + [row.get("NameAlias_Title", "") for row in rows])
        extra_values = []
        for row in rows:
            extra_values.extend(
                [
                    row.get("Identification_Number", ""),
                    row.get("Identification_TypeDescription", ""),
                    row.get("Address_Street", ""),
                    row.get("Address_Region", ""),
                ]
            )
        records.append(
            build_record(
                source="EU",
                entity_id=str(entity_id),
                reference=first_non_empty([row.get("Entity_EU_ReferenceNumber", "") for row in rows]),
                whole_name=first_non_empty([row.get("NameAlias_WholeName", "") for row in rows]),
                aliases=aliases,
                subject_type=first_non_empty([row.get("Entity_SubjectType", "") for row in rows]),
                programme=first_non_empty([row.get("Entity_Regulation_Programme", "") for row in rows]),
                country=countries,
                city=cities,
                birth_year=extract_years(*[row.get("BirthDate_Year", "") for row in rows], *[row.get("BirthDate_BirthDate", "") for row in rows]),
                listed_on=first_non_empty([row.get("Entity_DesignationDate", "") for row in rows]),
                functions=functions,
                designation_details=unique_values([row.get("Entity_DesignationDetails", "") for row in rows]),
                remarks=remarks,
                extra_values=extra_values,
            )
        )
    return records


def load_un_records() -> list[dict[str, str]]:
    if not UN_XML_FILE.exists():
        return []
    root = ET.parse(UN_XML_FILE).getroot()
    records: list[dict[str, str]] = []

    for item in root.findall("./INDIVIDUALS/INDIVIDUAL"):
        name_parts = [
            text_of(item, "FIRST_NAME"),
            text_of(item, "SECOND_NAME"),
            text_of(item, "THIRD_NAME"),
            text_of(item, "FOURTH_NAME"),
        ]
        whole_name = " ".join(part for part in name_parts if part).strip()
        aliases = texts_of(item, "./INDIVIDUAL_ALIAS/ALIAS_NAME")
        countries = texts_of(item, "./NATIONALITY/VALUE") + texts_of(item, "./INDIVIDUAL_ADDRESS/COUNTRY") + texts_of(item, "./INDIVIDUAL_PLACE_OF_BIRTH/COUNTRY")
        cities = texts_of(item, "./INDIVIDUAL_ADDRESS/CITY") + texts_of(item, "./INDIVIDUAL_PLACE_OF_BIRTH/CITY") + texts_of(item, "./INDIVIDUAL_PLACE_OF_BIRTH/CITY_OF_BIRTH")
        birth_values = texts_of(item, "./INDIVIDUAL_DATE_OF_BIRTH/DATE") + texts_of(item, "./INDIVIDUAL_DATE_OF_BIRTH/YEAR") + texts_of(item, "./INDIVIDUAL_DATE_OF_BIRTH/FROM_YEAR") + texts_of(item, "./INDIVIDUAL_DATE_OF_BIRTH/TO_YEAR")
        functions = texts_of(item, "./TITLE") + texts_of(item, "./DESIGNATION/VALUE")
        designation = texts_of(item, "./DESIGNATION/VALUE")
        remarks = [text_of(item, "COMMENTS1")]
        extra_values = (
            texts_of(item, "./INDIVIDUAL_DOCUMENT/NUMBER")
            + texts_of(item, "./INDIVIDUAL_DOCUMENT/TYPE_OF_DOCUMENT")
            + texts_of(item, "./INDIVIDUAL_DOCUMENT/ISSUING_COUNTRY")
            + texts_of(item, "./LAST_DAY_UPDATED/VALUE")
        )
        records.append(
            build_record(
                source="UN",
                entity_id=text_of(item, "DATAID"),
                reference=text_of(item, "REFERENCE_NUMBER"),
                whole_name=whole_name,
                aliases=aliases,
                subject_type="individual",
                programme=text_of(item, "UN_LIST_TYPE"),
                country=countries,
                city=cities,
                birth_year=extract_years(*birth_values),
                listed_on=text_of(item, "LISTED_ON"),
                functions=functions,
                designation_details=designation,
                remarks=remarks,
                extra_values=extra_values,
            )
        )

    for item in root.findall("./ENTITIES/ENTITY"):
        whole_name = text_of(item, "FIRST_NAME")
        aliases = texts_of(item, "./ENTITY_ALIAS/ALIAS_NAME")
        countries = texts_of(item, "./ENTITY_ADDRESS/COUNTRY")
        cities = texts_of(item, "./ENTITY_ADDRESS/CITY")
        designation = texts_of(item, "./DESIGNATION/VALUE")
        remarks = [text_of(item, "COMMENTS1")]
        extra_values = texts_of(item, "./ENTITY_ADDRESS/STATE_PROVINCE") + texts_of(item, "./ENTITY_ADDRESS/STREET") + texts_of(item, "./LAST_DAY_UPDATED/VALUE")
        records.append(
            build_record(
                source="UN",
                entity_id=text_of(item, "DATAID"),
                reference=text_of(item, "REFERENCE_NUMBER"),
                whole_name=whole_name,
                aliases=aliases,
                subject_type="entity",
                programme=text_of(item, "UN_LIST_TYPE"),
                country=countries,
                city=cities,
                birth_year=[],
                listed_on=text_of(item, "LISTED_ON"),
                functions=designation,
                designation_details=designation,
                remarks=remarks,
                extra_values=extra_values,
            )
        )

    return records


def parse_ofac_aliases(remarks: str) -> list[str]:
    matches = re.findall(r"(?:a\.k\.a\.|f\.k\.a\.)\s+'([^']+)'", remarks or "", flags=re.IGNORECASE)
    return unique_values(matches)


# --- HÀM BÓC TÁCH BẢNG ĐỊA CHỈ ADD.CSV CỦA OFAC ---
def load_ofac_addresses() -> tuple[dict[str, list[str]], dict[str, list[str]], dict[str, list[str]]]:
    """
    Đọc file add.csv của OFAC để map mã ent_num ra: (City, Country, Full_Address)
    Mỗi dòng add.csv có cấu trúc: [ent_num, add_num, address, city/state/postal, country, remarks]
    """
    if not OFAC_ADD_FILE.exists():
        return {}, {}, {}

    city_map: dict[str, list[str]] = {}
    country_map: dict[str, list[str]] = {}
    addr_map: dict[str, list[str]] = {}

    try:
        df_add = pd.read_csv(
            OFAC_ADD_FILE,
            header=None,
            names=["ent_num", "add_num", "address", "city_state", "country", "add_remarks"],
            dtype=str,
            encoding="utf-8-sig",
            skip_blank_lines=True,
            engine="python",
        ).fillna("")

        for row in df_add.to_dict(orient="records"):
            ent_id = str(row.get("ent_num", "")).strip()
            if not ent_id:
                continue

            city_val = str(row.get("city_state", "")).replace("-0-", "").strip()
            country_val = str(row.get("country", "")).replace("-0-", "").strip()
            street_val = str(row.get("address", "")).replace("-0-", "").strip()

            if city_val:
                city_map.setdefault(ent_id, []).append(city_val)
            if country_val:
                country_map.setdefault(ent_id, []).append(country_val)
            
            full_addr = ", ".join(p for p in [street_val, city_val, country_val] if p)
            if full_addr:
                addr_map.setdefault(ent_id, []).append(full_addr)

    except Exception as e:
        print(f"Lỗi khi đọc file add.csv của OFAC: {e}")

    return city_map, country_map, addr_map


def load_ofac_records() -> list[dict[str, str]]:
    if not OFAC_SDN_FILE.exists():
        return []

    # Bổ sung dữ liệu địa chỉ từ file add.csv
    ofac_cities, ofac_countries, ofac_addrs = load_ofac_addresses()

    dataframe = pd.read_csv(
        OFAC_SDN_FILE,
        header=None,
        names=OFAC_COLUMNS,
        dtype=str,
        encoding="utf-8-sig",
        skip_blank_lines=True,
        engine="python",
    ).fillna("")
    dataframe = dataframe[dataframe["name"].astype(str).str.strip() != ""]

    records: list[dict[str, str]] = []
    for row in dataframe.to_dict(orient="records"):
        cleaned_row = {
            key: "" if str(value).strip() == "-0-" else str(value).strip()
            for key, value in row.items()
        }
        ent_id = cleaned_row["ent_num"]

        # Lấy thông tin địa chỉ ghép từ file add.csv
        matched_cities = unique_values(ofac_cities.get(ent_id, []))
        matched_countries = unique_values(ofac_countries.get(ent_id, []) + [cleaned_row["vessel_flag"]])
        matched_addrs = unique_values(ofac_addrs.get(ent_id, []))

        # Tổng hợp thông tin bổ sung để đưa vào tìm kiếm
        extra_info = list(cleaned_row.values()) + matched_addrs

        records.append(
            build_record(
                source="OFAC",
                entity_id=ent_id,
                reference=ent_id,
                whole_name=cleaned_row["name"],
                aliases=parse_ofac_aliases(cleaned_row["remarks"]),
                subject_type=cleaned_row["subject_type"] or "entity",
                programme=cleaned_row["programme"],
                country=matched_countries,
                city=matched_cities,
                birth_year=extract_years(cleaned_row["remarks"]),
                listed_on="",
                functions=unique_values([cleaned_row["title"], cleaned_row["vessel_type"], cleaned_row["vessel_owner"]]),
                designation_details=unique_values([cleaned_row["call_sign"], cleaned_row["tonnage"], cleaned_row["gross_tonnage"]]),
                remarks=unique_values([cleaned_row["remarks"]] + matched_addrs),
                extra_values=extra_info,
            )
        )
    return records


def load_records() -> list[dict[str, str]]:
    records = []
    records.extend(load_eu_records())
    records.extend(load_un_records())
    records.extend(load_ofac_records())
    records.sort(key=lambda item: (item["source"], normalize_text(item["whole_name"])))
    return records


def matches(record: dict[str, str], filters: dict[str, str]) -> bool:
    for key, raw_value in filters.items():
        value = raw_value.strip()
        if not value:
            continue
        
        if key == "keyword":
            if normalize_text(value) not in normalize_text(record.get("all_text", "")):
                return False
        else:
            if normalize_text(value) not in normalize_text(record.get(key, "")):
                return False
    return True


TEMPLATE = """
<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sanction Search</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    body { background: #f5f7fb; }
    .summary-card { border: 0; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08); }
    .small-muted { color: #6c757d; font-size: 0.9rem; }
    .accordion-button:not(.collapsed) { background: #eef4ff; color: #0f172a; }
  </style>
</head>
<body>
  <div class="container py-4">
    <div class="row g-4">
      <div class="col-12">
        <div class="card summary-card">
          <div class="card-body">
            <div class="d-flex flex-wrap justify-content-between align-items-start gap-3">
              <div>
                <div class="d-flex align-items-center gap-3 mb-2">
                  <img src="/static/logo.png" alt="Company Logo" style="height: 45px; object-fit: contain;" onerror="this.style.display='none'">
                  <h1 class="h3 mb-0">Sanction Search</h1>
                </div>
                <div class="small-muted">Tìm kiếm hợp nhất trên EU CSV, UN XML và OFAC SDN CSV.</div>
              </div>
              <div class="text-md-end">
                <div><strong>{{ total_records }}</strong> hồ sơ tổng</div>
                <div><strong>{{ total_matches }}</strong> kết quả khớp</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="col-12">
        <div class="card summary-card">
          <div class="card-body">
            <form method="get" class="row g-3">
              {% for field in search_fields %}
              <div class="col-12 col-md-6 col-xl-4">
                <label class="form-label">{{ field.label }}</label>
                {% if field.type == "select" %}
                <select name="{{ field.name }}" class="form-select">
                  {% for value, label in field.options %}
                  <option value="{{ value }}" {% if filters.get(field.name, "") == value %}selected{% endif %}>{{ label }}</option>
                  {% endfor %}
                </select>
                {% else %}
                <input
                  type="text"
                  name="{{ field.name }}"
                  value="{{ filters.get(field.name, '') }}"
                  placeholder="{{ field.placeholder }}"
                  class="form-control"
                >
                {% endif %}
              </div>
              {% endfor %}
              <div class="col-12 d-flex gap-2">
                <button class="btn btn-primary" type="submit">Tìm kiếm</button>
                <a href="/" class="btn btn-outline-secondary">Xóa bộ lọc</a>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div class="col-12">
        <div class="card summary-card">
          <div class="card-body">
            <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <div class="small-muted">Hiển thị {{ start_item }}-{{ end_item }} / {{ total_matches }} kết quả</div>
              {% if total_pages > 1 %}
              <nav>
                <ul class="pagination pagination-sm mb-0">
                  <li class="page-item {% if page <= 1 %}disabled{% endif %}">
                    <a class="page-link" href="{{ build_page_url(page - 1) }}">Trước</a>
                  </li>
                  {% for page_number in page_numbers %}
                  <li class="page-item {% if page_number == page %}active{% endif %}">
                    <a class="page-link" href="{{ build_page_url(page_number) }}">{{ page_number }}</a>
                  </li>
                  {% endfor %}
                  <li class="page-item {% if page >= total_pages %}disabled{% endif %}">
                    <a class="page-link" href="{{ build_page_url(page + 1) }}">Sau</a>
                  </li>
                </ul>
              </nav>
              {% endif %}
            </div>

            <div class="accordion" id="resultAccordion">
              {% for item in page_items %}
              <div class="accordion-item mb-2 border rounded-3 overflow-hidden">
                <h2 class="accordion-header" id="heading-{{ loop.index0 }}">
                  <button
                    class="accordion-button collapsed fw-semibold"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target="#collapse-{{ loop.index0 }}"
                    aria-expanded="false"
                    aria-controls="collapse-{{ loop.index0 }}"
                  >
                    <span>{{ item.whole_name }}</span>
                    <span class="ms-2 badge text-bg-secondary">{{ item.source }}</span>
                    {% if item.subject_type %}
                    <span class="ms-2 badge text-bg-light">{{ item.subject_type }}</span>
                    {% endif %}
                  </button>
                </h2>
                <div
                  id="collapse-{{ loop.index0 }}"
                  class="accordion-collapse collapse"
                  aria-labelledby="heading-{{ loop.index0 }}"
                  data-bs-parent="#resultAccordion"
                >
                  <div class="accordion-body">
                    <div class="row g-3">
                      {% for key, label in detail_fields %}
                      <div class="col-12 col-md-6 col-xl-4">
                        <div class="small-muted">{{ label }}</div>
                        <div>{{ item.get(key, '') or '-' }}</div>
                      </div>
                      {% endfor %}
                    </div>
                  </div>
                </div>
              </div>
              {% else %}
              <div class="text-center py-4">Không tìm thấy dữ liệu phù hợp.</div>
              {% endfor %}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
"""


@app.route("/", methods=["GET"])
def index():
    filters = {field["name"]: request.args.get(field["name"], "").strip() for field in SEARCH_FIELDS}
    page = request.args.get("page", default=1, type=int) or 1

    matched_records = [record for record in RECORDS if matches(record, filters)]
    total_matches = len(matched_records)
    total_pages = max(1, math.ceil(total_matches / PAGE_SIZE))
    page = max(1, min(page, total_pages))
    start = (page - 1) * PAGE_SIZE
    end = start + PAGE_SIZE
    page_items = matched_records[start:end]

    def build_page_url(page_number: int) -> str:
        args = {key: value for key, value in filters.items() if value}
        args["page"] = page_number
        return "?" + urlencode(args)

    start_item = start + 1 if total_matches else 0
    end_item = min(end, total_matches)
    page_numbers = list(range(max(1, page - 2), min(total_pages, page + 2) + 1))

    return render_template_string(
        TEMPLATE,
        filters=filters,
        total_records=len(RECORDS),
        total_matches=total_matches,
        page=page,
        total_pages=total_pages,
        page_items=page_items,
        page_numbers=page_numbers,
        start_item=start_item,
        end_item=end_item,
        search_fields=SEARCH_FIELDS,
        detail_fields=DETAIL_FIELDS,
        build_page_url=build_page_url,
    )


update_sanction_files()

scheduler = BackgroundScheduler()
scheduler.add_job(func=update_sanction_files, trigger="interval", hours=24)
scheduler.start()


if __name__ == "__main__":
    app.run(debug=False, host='0.0.0.0', port=8845)