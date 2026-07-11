import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { JwtService } from '@nestjs/jwt';
import type { ScanProgress } from '@sentinelx/shared';

@WebSocketGateway({
  namespace: '/scans',
  cors: {
    origin: process.env['ALLOWED_ORIGINS']?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class ScanProgressGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    @InjectPinoLogger(ScanProgressGateway.name)
    private readonly logger: PinoLogger,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        client.handshake.auth['token'] as string | undefined ??
        (client.handshake.headers.authorization?.replace('Bearer ', ''));

      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = this.jwtService.verify<{ sub: string; orgId: string }>(token);
      client.data['userId'] = payload.sub;
      client.data['organizationId'] = payload.orgId;

      this.logger.debug({ clientId: client.id, userId: payload.sub }, 'WebSocket connected');
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug({ clientId: client.id }, 'WebSocket disconnected');
  }

  @SubscribeMessage('subscribe:scan')
  handleSubscribeScan(
    @MessageBody() data: { scanId: string },
    @ConnectedSocket() client: Socket,
  ): void {
    const room = `scan:${data.scanId}:${client.data['organizationId'] as string}`;
    void client.join(room);
  }

  @SubscribeMessage('unsubscribe:scan')
  handleUnsubscribeScan(
    @MessageBody() data: { scanId: string },
    @ConnectedSocket() client: Socket,
  ): void {
    const room = `scan:${data.scanId}:${client.data['organizationId'] as string}`;
    void client.leave(room);
  }

  emitScanProgress(orgId: string, scanId: string, progress: ScanProgress): void {
    const room = `scan:${scanId}:${orgId}`;
    this.server.to(room).emit('scan:progress', progress);
  }

  emitScanCompleted(orgId: string, scanId: string, summary: Record<string, unknown>): void {
    const room = `scan:${scanId}:${orgId}`;
    this.server.to(room).emit('scan:completed', summary);
    // Also emit to org-wide channel
    this.server.to(`org:${orgId}`).emit('scan:completed', { scanId, ...summary });
  }

  emitNewVulnerability(orgId: string, vulnerability: Record<string, unknown>): void {
    this.server.to(`org:${orgId}`).emit('vulnerability:new', vulnerability);
  }

  emitNotification(orgId: string, notification: Record<string, unknown>): void {
    const userId = notification['userId'] as string | undefined;
    if (userId) {
      this.server.to(`user:${userId}`).emit('notification', notification);
    } else {
      this.server.to(`org:${orgId}`).emit('notification', notification);
    }
  }
}
