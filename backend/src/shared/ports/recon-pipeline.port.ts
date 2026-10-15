/**
 * Cổng điều phối luồng Ingress & Đối soát tích hợp (Recon Pipeline Port)
 * Cho phép các Worker của TradingOps kích hoạt luồng tải dữ liệu tươi từ BotEngine
 * mà không vi phạm rào chắn module isolation (Clean Architecture Ports & Adapters).
 */
export interface IReconPipelinePort {
  handleCheckKlgdJob(job: any): Promise<any>;
  handleCheckPreEodJob(job: any): Promise<any>;
}

export const RECON_PIPELINE_PORT = 'IReconPipelinePort';
