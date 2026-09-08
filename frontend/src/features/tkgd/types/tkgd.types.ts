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
