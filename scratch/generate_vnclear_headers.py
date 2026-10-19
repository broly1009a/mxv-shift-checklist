import json

with open('coreccp-api-client/src/schemas/ag_grid_column_schemas.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

mapping = {}
for screen_key, screen_data in data.items():
    mapping[screen_key] = {}
    for col in screen_data.get('columns', []):
        mapping[screen_key][col['key']] = col['header']

ts_content = f"""/**
 * VNCLEAR (CoreCCP & CoreEX) AG GRID COLUMN HEADERS REGISTRY
 * Tự động ánh xạ key trường dữ liệu tiếng Anh sang Header tiếng Việt chuẩn Enterprise.
 */

export const VNCLEAR_COLUMN_HEADERS: Record<string, Record<string, string>> = {json.dumps(mapping, indent=2, ensure_ascii=False)};

export function resolveVnclearColumnHeader(searchCode: string, key: string): string {{
  if (!searchCode || !key) return key;
  const upper = searchCode.toUpperCase();
  let targetScreen = upper;
  if (upper === 'INSTRUMENTS' || upper === 'INSTRUMENTS_ACM') targetScreen = 'COMMODITY_CONTRACT';
  else if (upper === 'COMMODITY_ACM') targetScreen = 'COMMODITY';
  else if (upper.includes('ORDERMATCH')) targetScreen = 'ORDERMATCH_DETAIL';
  else if (upper.includes('ORDERBOOK')) targetScreen = 'ORDERBOOK';
  else if (upper.includes('OPEN_POSITION')) targetScreen = 'OPEN_POSITION_EXPORT';
  else if (upper === 'SETTLEMENT_ACM') targetScreen = 'SETTLEMENT';

  const screenHeaders = VNCLEAR_COLUMN_HEADERS[targetScreen] || VNCLEAR_COLUMN_HEADERS[upper];
  return screenHeaders?.[key] || key;
}}
"""

with open('backend/src/shared/domain-configs/vnclear-column-headers.config.ts', 'w', encoding='utf-8') as f:
    f.write(ts_content)

print('Generated backend/src/shared/domain-configs/vnclear-column-headers.config.ts successfully')
