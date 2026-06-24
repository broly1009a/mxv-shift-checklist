import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ShiftsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Socket client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Socket client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody() data: { shiftLogId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (data?.shiftLogId) {
      client.join(data.shiftLogId);
      console.log(`Client ${client.id} joined shift room: ${data.shiftLogId}`);
    }
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @MessageBody() data: { shiftLogId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (data?.shiftLogId) {
      client.leave(data.shiftLogId);
      console.log(`Client ${client.id} left shift room: ${data.shiftLogId}`);
    }
  }

  notifyShiftUpdate(shiftLogId: string, updatedLog: any, auditLog?: any) {
    if (this.server) {
      this.server.to(shiftLogId).emit('shift-updated', {
        shiftLog: updatedLog,
        auditLog,
      });
      console.log(`Broadcasted update to room: ${shiftLogId}`);
    }
  }

  emitEvent(
    eventType: 'SHIFT_JOB_GENERATED' | 'SHIFT_JOB_UPDATED' | 'SHIFT_JOB_CLOSED' | 'TASK_UPDATED' | 'NOTIFICATION_CREATED' | 'DASHBOARD_UPDATED',
    jobId: string | null,
    departmentId: string | null,
    shiftSlotId: string | null,
    date: string,
    data: any,
  ) {
    const eventNameMap = {
      SHIFT_JOB_GENERATED: 'shift-job-generated',
      SHIFT_JOB_UPDATED: 'shift-job-updated',
      SHIFT_JOB_CLOSED: 'shift-job-closed',
      TASK_UPDATED: 'task-updated',
      NOTIFICATION_CREATED: 'notification-created',
      DASHBOARD_UPDATED: 'dashboard-updated',
    };

    const payload = {
      eventType,
      jobId,
      departmentId,
      shiftSlotId,
      date,
      data,
    };

    const eventName = eventNameMap[eventType];
    if (eventName && this.server) {
      this.server.emit(eventName, payload);
      if (jobId) {
        this.server.to(jobId).emit(eventName, payload);
      }
      console.log(`[WebSocket] Emitted event '${eventName}' to room/global with payload:`, JSON.stringify(payload));
    }
  }
}
