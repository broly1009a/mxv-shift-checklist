export interface MismatchedTrade {
  source?: string;
  maTKGD?: string;
  maHD?: string;
  giaKhop?: string;
  klGiaoDich?: string;
  reason?: string;
}

export interface MismatchedPosition {
  account: string;
  symbol: string;
  msPosition: number;
  cqgPosition: number;
  differ: number;
}

export interface MismatchedTTTT {
  account?: string;
  maTKGD?: string;
  ttttValue: number;
  psValue: number;
  differ: number;
}

export interface FileAuditItem {
  id: number;
  filename: string;
  status: 'OK' | 'MISSING' | 'OUTDATED' | 'DOWNLOADED';
  detail?: string;
}

export interface MarginAccount {
  account: string;
  value: number;
}

export interface ParsedBotData {
  rawText: string;
  isJson: boolean;
  jsonType: string;
  jsonResult: any;
  message: string;
  fileItems: FileAuditItem[];
  marginAccounts: MarginAccount[];
}
