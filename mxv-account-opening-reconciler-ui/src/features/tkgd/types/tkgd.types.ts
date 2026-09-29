export interface CleanRecord {
  _id: string;
  batchDate: string;
  maTVKD: string;
  maTKGD?: string;
  maTKGDBase?: string;
  accountType?: 'FUTURES' | 'ACM' | 'LME' | 'SPREAD';
  accountTypes?: string[];
  subAccounts?: Array<{
    code: string;
    type: string;
    status: string;
  }>;
  noiDungMail?: {
    maTKGD_Futures?: string;
    maTKGD_ACM?: string;
    maTKGD_LME?: string;
    maTKGD_Spread?: string;
    tenTaiKhoan?: string;
    hasACMRequest?: boolean;
    hasLMERequest?: boolean;
    hasSpreadRequest?: boolean;
    receivedDateTime?: string | Date;
  };
  hopDong?: {
    soHopDong?: string;
    soCanCuoc?: string;
    hoVaTen?: string;
    ngaySinh?: string;
    rawNgaySinh?: string;
    ngayCap?: string;
    rawNgayCap?: string;
    noiCap?: string;
    ngayKyHD?: string;
    gioiTinh?: string;
    rawGioiTinh?: string;
    dinhDangLoi?: string[];
    loaiHinhTaiKhoan?: string;
    chuKy?: string;
  };
  phuLuc?: {
    soHopDongGoc?: string;
    soCanCuoc?: string;
    hoVaTen?: string;
    ngaySinh?: string;
    ngayCap?: string;
    noiCap?: string;
    ngayKyHD?: string;
    chuKy?: string;
  };
  canCuoc?: {
    soCanCuoc?: string;
    hoVaTen?: string;
    ngaySinh?: string;
    rawNgaySinh?: string;
    ngayCap?: string;
    rawNgayCap?: string;
    noiCap?: string;
    gioiTinh?: string;
    canhBaoChatLuong?: string[];
    coGiaTriDen?: string;
    source?: string;
    ocrConfidence?: string;
    diaChiThuongTru?: string;
    theGeneration?: string;
    confidenceScore?: number;
    boundingBoxes?: Record<string, any>;
  };
  ms?: {
    maTKGD?: string;
    tenTKGD?: string;
    hoVaTen?: string;
    soCMND_HoChieu?: string;
    ngaySinh?: string;
    rawNgaySinh?: string;
    ngayCap?: string;
    rawNgayCap?: string;
    noiCap?: string;
    gioiTinh?: string;
    ngayThamGia?: string;
    loaiHinhTaiKhoan?: string;
    trangThai?: string;
    chuKy?: string;
    isFoundOnMS?: boolean;
    cccdMatTruocLocalPath?: string;
    cccdMatSauLocalPath?: string;
    chuKyLocalPath?: string;
    cccdOcr_soCanCuoc?: string;
    cccdOcr_hoVaTen?: string;
    soSanh_CCCD_Mail_vs_MS?: string;
  };
  ketLuan?: {
    trangThai: string;
    danhSachLoi: string[];
    reconciledAt?: string;
  };
  manualReview?: {
    isOverridden: boolean;
    status?: string;
    approvedBy?: string;
    approvedAt?: string;
    reason?: string;
  };
  snapshots?: Array<{
    snapshotAt: string;
    action: string;
    previousData: any;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

export type FilterStatus =
  | 'ALL'
  | 'KHOP'
  | 'CAN_KIEM_TRA'
  | 'KHOP_TEXT'
  | 'LECH'
  | 'FUTURES'
  | 'ACM'
  | 'LME'
  | 'SPREAD';

export type SprintMode = 'FAST' | 'FULL';

export interface RunPipelineOptions {
  downloadImages?: boolean;
  batchDate?: string;
  fromDateTime?: string;
  toDateTime?: string;
  forceReparse?: boolean;
}

export interface TkgdStats {
  totalCount: number;
  pendingMsCount: number;
  matchedCount: number;
  matchedTextCount?: number;
  canKiemTraCount?: number;
  mismatchedCount: number;
  futuresCount?: number;
  acmCount?: number;
  lmeCount?: number;
  spreadCount?: number;
}

export interface ManifestFileItem {
  fileName: string;
  size: number;
  subType: string;
  url: string;
}

export interface AccountManifest {
  success: boolean;
  accountCode: string;
  batchDate: string;
  directory: string;
  totalFiles: number;
  files: {
    mailCccdFront?: ManifestFileItem;
    mailCccdBack?: ManifestFileItem;
    mailContractPdf?: ManifestFileItem;
    mailPl01Pdf?: ManifestFileItem;
    msCccdFront?: ManifestFileItem;
    msCccdBack?: ManifestFileItem;
    msSignature?: ManifestFileItem;
  };
  otherFiles: ManifestFileItem[];
  ocrSummary: {
    soCanCuocMail?: string;
    soCanCuocMs?: string;
    hoTenMail?: string;
    hoTenMs?: string;
    canhBaoChatLuong?: string[];
    dinhDangLoi?: string[];
    theGeneration?: string;
    confidenceScore?: number;
  };
}

export interface PreviewImageState {
  url: string;
  title: string;
  source: 'MAIL' | 'MS';
  rotation: number;
}

export interface PreviewPdfState {
  url: string;
  title: string;
}

export interface BadgeInfo {
  bg: string;
  color: string;
  border: string;
  label: string;
}

export interface ReconcileSummary {
  totalRecords: number;
  khopCount: number;
  canKiemTraCount: number;
  lechCount: number;
  outputFilePath?: string;
}

export interface TkgdProgressState {
  isProcessing: boolean;
  taskType: 'SYNC_MAIL' | 'SYNC_MS' | 'RECONCILE' | 'PIPELINE_ALL' | 'IDLE';
  current: number;
  total: number;
  percent: number;
  currentCode?: string;
  currentName?: string;
  stage: string;
  detail?: string;
  updatedAt: number;
}

export interface TkgdAutoPipelineStatus {
  enabled: boolean;
  isRunning: boolean;
  lastRunTime: number;
  lastProcessedCount: number;
  intervalMinutes: number;
  nextRunTime: number;
  executionMode?: 'BATCH' | 'INSTANT_STREAM';
}

export type TkgdShiftType = 'ALL' | 'MORNING' | 'AFTERNOON' | 'OVERTIME' | 'NIGHT';
export type TkgdTimeRangeType = 'DAY' | 'WEEK' | 'MONTH';

export interface TkgdKpiStats {
  totalEmails: number;
  scannedSuccess: number;
  pendingProcessing: number;
  matchedCount: number;
  canKiemTraCount: number;
  mismatchedCount: number;
  invalidFormatCount: number;
  matchRate: number;
}

export interface TkgdSubAccountStats {
  futuresCount: number;
  acmCount: number;
  lmeCount: number;
  spreadCount: number;
  acmRate: number;
  lmeRate: number;
  spreadRate: number;
}

export interface TkgdHourlyItem {
  hour: string;
  label: string;
  total: number;
  matched: number;
  mismatched: number;
  canKiemTra: number;
}

export interface TkgdMemberItem {
  maTVKD: string;
  name: string;
  total: number;
  matched: number;
  mismatched: number;
  canKiemTra: number;
  matchRate: number;
}

export interface TkgdPendingHandoverItem {
  maTKGD: string;
  maTKGDBase?: string;
  hoVaTen: string;
  maTVKD: string;
  trangThai: string;
  lyDoLech: string;
  hanhDongCaSau: string;
  receivedDateTime?: string;
}

export interface TkgdLatencyStats {
  avgTotalSeconds: number;
  mailIngestSeconds: number;
  ocrSeconds: number;
  msScraperSeconds: number;
  reconcileSeconds: number;
  throughputPerHour: number;
  healthStatus: string;
}

export interface TkgdAnalyticsSummary {
  batchDate: string;
  dateRangeLabel?: string;
  shift: TkgdShiftType;
  range: TkgdTimeRangeType;
  kpi: TkgdKpiStats;
  subAccounts: TkgdSubAccountStats;
  hourlyDistribution: TkgdHourlyItem[];
  topMembers: TkgdMemberItem[];
  pendingHandoverList: TkgdPendingHandoverItem[];
  latency: TkgdLatencyStats;
}



