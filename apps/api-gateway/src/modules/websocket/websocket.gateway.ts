import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  namespace: '/',
  cors: {
    origin: process.env['ALLOWED_ORIGINS']?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  },
})
export class WebSocketGatewayService implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly connectedClients = new Map<string, { userId: string; organizationId: string }>();

  constructor(
    @InjectPinoLogger(WebSocketGatewayService.name)
    private readonly logger: PinoLogger,
    private readonly jwtService: JwtService,
  ) {}

  afterInit(_server: Server): void {
    this.logger.info('WebSocket gateway initialized');
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        client.handshake.auth['token'] as string | undefined ??
        client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = this.jwtService.verify<{ sub: string; orgId: string }>(token);
      client.data['userId'] = payload.sub;
      client.data['organizationId'] = payload.orgId;

      // Join org room for broadcast
      await client.join(`org:${payload.orgId}`);
      await client.join(`user:${payload.sub}`);

      this.connectedClients.set(client.id, { userId: payload.sub, organizationId: payload.orgId });
      this.logger.debug({ clientId: client.id, userId: payload.sub }, 'WebSocket connected');
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.connectedClients.delete(client.id);
    this.logger.debug({ clientId: client.id }, 'WebSocket disconnected');
  }

  getConnectedUserCount(orgId: string): number {
    return [...this.connectedClients.values()].filter((c) => c.organizationId === orgId).length;
  }

  emitToOrg(orgId: string, event: string, data: unknown): void {
    this.server.to(`org:${orgId}`).emit(event, data);
  }

  emitToUser(userId: string, event: string, data: unknown): void {
    this.server.to(`user:${userId}`).emit(event, data);
  }
}
