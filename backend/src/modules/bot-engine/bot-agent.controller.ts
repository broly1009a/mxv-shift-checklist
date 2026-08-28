import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpException,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
  Logger,
  Query,
  Headers,
  HttpCode,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as path from 'path';
import * as fs from 'fs';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { BotJob } from '../../schemas/bot-job.schema';
import { BotJobQueueService } from './bot-job-queue.service';

@Controller('api/v1/bot-engine/agent')
export class AgentController {
  private readonly logger = new Logger('AgentController');
  public static agentStatuses = new Map<
    string,
    { hostname: string; platform: string; lastSeen: Date }
  >();
  private static sessionTokens = new Map<
    string,
    { hostname: string; expireAt: number }
  >();

  constructor(
    @InjectModel(BotJob.name) private readonly botJobModel: Model<BotJob>,
    private readonly jobQueueService: BotJobQueueService,
  ) {}

  private validateKey(headers: Record<string, string>) {
    // 1. Check dynamic session token
    const authHeader = headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const session = AgentController.sessionTokens.get(token);
      if (session && session.expireAt > Date.now()) {
        return; // Valid session
      }
    }

    // 2. Fallback to static API key for backward compatibility or handshake
    const key = headers['x-agent-api-key'];
    const expected = process.env.RPA_AGENT_API_KEY || 'mxv-agent-key';
    if (key && key === expected) {
      return;
    }

    throw new HttpException(
      'Unauthorized: Invalid Agent API Key or Session Token',
      HttpStatus.UNAUTHORIZED,
    );
  }

  // POST /api/v1/bot-engine/agent/login
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: { apiKey: string; hostname: string }) {
    const expected = process.env.RPA_AGENT_API_KEY || 'mxv-agent-key';
    if (!body.apiKey || body.apiKey !== expected) {
      throw new HttpException(
        'Unauthorized: Invalid Agent API Key',
        HttpStatus.UNAUTHORIZED,
      );
    }
    const token =
      'sess_' +
      Math.random().toString(36).substring(2) +
      Math.random().toString(36).substring(2);
    const expireAt = Date.now() + 60 * 60 * 1000; // 1 hour
    AgentController.sessionTokens.set(token, {
      hostname: body.hostname || 'unknown',
      expireAt,
    });
    this.logger.log(`Session login successful for agent: ${body.hostname}`);
    return { token, expireAt: new Date(expireAt).toISOString() };
  }

  // POST /api/v1/bot-engine/agent/logout
  @Post('logout')
  async logout(
    @Headers() headers: Record<string, string>,
    @Body() body?: { hostname?: string },
  ) {
    const authHeader = headers['authorization'];
    let hostname = body?.hostname || 'unknown';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (AgentController.sessionTokens.has(token)) {
        const session = AgentController.sessionTokens.get(token);
        hostname = session?.hostname || hostname;
        this.logger.log(`Session logout successful for agent: ${hostname}`);
        AgentController.sessionTokens.delete(token);
      }
    }
    if (hostname && hostname !== 'unknown') {
      AgentController.agentStatuses.delete(hostname);
    }
    return { ok: true };
  }

  // GET /api/v1/bot-engine/agent/version
  @Get('version')
  async version() {
    const latestVersion = process.env.RPA_AGENT_LATEST_VERSION || '1.0.0';
    const downloadUrl = process.env.RPA_AGENT_DOWNLOAD_URL || '';
    return { latestVersion, downloadUrl };
  }

  // POST /api/v1/bot-engine/agent/heartbeat
  @Post('heartbeat')
  async heartbeat(
    @Headers() headers: Record<string, string>,
    @Body() body: any,
  ) {
    this.validateKey(headers);
    const hostname = body.hostname || 'unknown';
    AgentController.agentStatuses.set(hostname, {
      hostname,
      platform: body.platform || 'unknown',
      lastSeen: new Date(),
    });
    this.logger.log(`Heartbeat from ${hostname}`);
    return { ok: true };
  }

  // GET /api/v1/bot-engine/agent/status
  @Get('status')
  async status(
    @Headers() headers: Record<string, string>,
    @Query('hostname') queryHostname?: string,
  ) {
    this.validateKey(headers);
    if (queryHostname) {
      const status = AgentController.agentStatuses.get(queryHostname);
      if (!status) return { online: false };
      const diffMs = Date.now() - status.lastSeen.getTime();
      const online = diffMs < 180_000; // 3 minutes timeout
      return { online, ...status, lastSeenMs: diffMs };
    }
    const statuses = Array.from(AgentController.agentStatuses.values());
    if (statuses.length === 0) return { online: false };
    const sorted = statuses.sort(
      (a, b) => b.lastSeen.getTime() - a.lastSeen.getTime(),
    );
    const status = sorted[0];
    const diffMs = Date.now() - status.lastSeen.getTime();
    const online = diffMs < 180_000;
    return { online, ...status, lastSeenMs: diffMs };
  }

  // GET /api/v1/bot-engine/agent/poll
  @Get('poll')
  async poll(@Headers() headers: Record<string, string>) {
    this.validateKey(headers);
    const REMOTE_JOB_TYPES = [
      'RUN_LOT_MACRO',
      'RUN_VALUE_MACRO',
      'RPA_DOWNLOAD_REPORTS',
      'DOWNLOAD_CAST',
      'FILE_AUDIT_MS',
      'FILE_AUDIT_CQG',
      'FILE_AUDIT_ACM',
    ];
    const job = await this.botJobModel
      .findOne({ status: 'PENDING', jobType: { $in: REMOTE_JOB_TYPES } })
      .sort({ createdAt: 1 })
      .exec();
    return { job: job || null };
  }

  // POST /api/v1/bot-engine/agent/jobs/:id/start
  @Post('jobs/:id/start')
  async start(
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
  ) {
    this.validateKey(headers);
    const job = await this.botJobModel.findById(id).exec();
    if (!job) throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
    job.attempts = (job.attempts || 0) + 1;
    job.logs.push(`[${new Date().toISOString()}] Agent picked up job.`);
    await this.jobQueueService.syncJobToChecklist(job, 'PROCESSING');
    return { ok: true };
  }

  // POST /api/v1/bot-engine/agent/jobs/:id/log
  @Post('jobs/:id/log')
  async appendLog(
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
    @Body() body: { message: string },
  ) {
    this.validateKey(headers);
    const job = await this.botJobModel.findById(id).exec();
    if (!job) throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
    job.logs.push(`[${new Date().toISOString()}] [Agent] ${body.message}`);
    await job.save();
    return { ok: true };
  }

  // POST /api/v1/bot-engine/agent/jobs/:id/complete
  @Post('jobs/:id/complete')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (
          req: Express.Request,
          _file: Express.Multer.File,
          cb: (error: Error | null, destination: string) => void,
        ) => {
          const dir = path.join(process.cwd(), 'uploads', 'agent-results');
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (
          _req: Express.Request,
          file: Express.Multer.File,
          cb: (error: Error | null, filename: string) => void,
        ) => cb(null, `${Date.now()}_${file.originalname}`),
      }),
    }),
  )
  async complete(
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    this.validateKey(headers);
    const job = await this.botJobModel.findById(id).exec();
    if (!job) throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
    const now = new Date().toISOString();
    job.logs.push(`[${now}] Job completed by Agent.`);
    if (file) {
      const p =
        job.payload instanceof Map
          ? Object.fromEntries(job.payload)
          : job.payload || {};
      p.agentUploadedFile = file.path;
      job.payload = p;
      job.logs.push(
        `[${now}] File uploaded: ${file.originalname} -> ${file.path}`,
      );
    }
    await this.jobQueueService.syncJobToChecklist(job, 'COMPLETED');
    this.logger.log(
      `Job ${id} marked COMPLETED by agent. File: ${file?.path || 'none'}`,
    );
    return { ok: true };
  }

  // POST /api/v1/bot-engine/agent/jobs/:id/fail
  @Post('jobs/:id/fail')
  async fail(
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
    @Body() body: { error: string },
  ) {
    this.validateKey(headers);
    const job = await this.botJobModel.findById(id).exec();
    if (!job) throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
    const targetStatus = job.attempts < job.maxAttempts ? 'PENDING' : 'FAILED';
    job.logs.push(
      `[${new Date().toISOString()}] [Agent] FAILED: ${body.error}`,
    );
    await this.jobQueueService.syncJobToChecklist(
      job,
      targetStatus,
      body.error,
    );
    this.logger.warn(`Job ${id} failed by agent: ${body.error}`);
    return { ok: true };
  }

  // POST /api/v1/bot-engine/agent/jobs/:id/captcha
  @Post('jobs/:id/captcha')
  async captcha(
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
    @Body() body: { captchaImage?: string; captchaText?: string },
  ) {
    this.validateKey(headers);
    const job = await this.botJobModel.findById(id).exec();
    if (!job) throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
    const p =
      job.payload instanceof Map
        ? Object.fromEntries(job.payload)
        : job.payload || {};
    let targetStatus = job.status;
    if (body.captchaImage) {
      p.captchaImage = body.captchaImage;
      targetStatus = 'AWAITING_CAPTCHA';
      job.logs.push(
        `[${new Date().toISOString()}] Captcha required. Waiting for user input.`,
      );
    }
    if (body.captchaText) {
      p.captchaText = body.captchaText;
      p.captchaImage = undefined;
      targetStatus = 'PROCESSING';
      job.logs.push(`[${new Date().toISOString()}] Captcha submitted by user.`);
    }
    job.payload = p;
    await this.jobQueueService.syncJobToChecklist(job, targetStatus as any);
    return { ok: true, captchaText: p.captchaText || null };
  }
}
