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
    this.server.to(shiftLogId).emit('shift-updated', {
      shiftLog: updatedLog,
      auditLog,
    });
    console.log(`Broadcasted update to room: ${shiftLogId}`);
  }
}
