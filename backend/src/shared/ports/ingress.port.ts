/**
 * Ingress Port Interface
 * Cổng giao tiếp chuẩn hóa cho việc kéo dữ liệu từ bên ngoài (Web Crawler, SFTP, REST API, gRPC).
 * Áp dụng mô hình Hexagonal Architecture / Clean Architecture.
 */

import {
  IngressSourceType,
  IngressDownloadOptions,
  IngressDownloadResult,
} from '../contracts/ingress-result.contract';

export const INGRESS_PORT = 'INGRESS_PORT';

export interface IIngressPort {
  /**
   * Tải một hoặc nhiều báo cáo từ nguồn chỉ định (MS, CQG, ACM, CCP, CoreEX, CoreCCP)
   */
  download(
    source: IngressSourceType,
    options?: IngressDownloadOptions,
  ): Promise<IngressDownloadResult>;

  /**
   * Kiểm tra tình trạng kết nối tới nguồn dữ liệu
   */
  checkHealth?(source?: IngressSourceType): Promise<boolean>;
}
