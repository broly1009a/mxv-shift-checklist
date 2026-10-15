/**
 * ============================================================================
 * CORECCP-CLIENT.MODULE.TS
 * ============================================================================
 * NestJS Module đăng ký toàn bộ thành phần của phân hệ CoreCCP Client.
 * Thiết kế hoàn toàn độc lập, dễ dàng import vào bất kỳ Module nào.
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { CoreCcpAuthService } from './coreccp-auth.service';
import { CoreCcpSocketClient } from './coreccp-socket.client';
import { CoreCcpRestClient } from './coreccp-rest.client';
import { CoreCcpCrawlerService } from './coreccp-crawler.service';
import { CoreCcpClientService } from './coreccp-client.service';

@Module({
  providers: [
    CoreCcpAuthService,
    CoreCcpSocketClient,
    CoreCcpRestClient,
    CoreCcpCrawlerService,
    CoreCcpClientService,
  ],
  exports: [
    CoreCcpClientService,
    CoreCcpAuthService,
    CoreCcpSocketClient,
    CoreCcpRestClient,
    CoreCcpCrawlerService,
  ],
})
export class CoreCcpClientModule {}
