import { Inject, Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { TOKEN_VERIFIER, type TokenVerifier } from '../auth/token-verifier';
import { UsersService } from '../users/users.service';

function corsOrigins(): string[] {
  const configured = process.env.WEB_ORIGIN?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return configured?.length ? configured : ['http://localhost:3000'];
}

// Same shape as NotificationsGateway (separate namespace, separate room
// registry) rather than reusing it directly: a chat message and a generic
// notification are different enough in how the frontend consumes them
// (one appends to an open thread, the other bumps a bell badge) that
// sharing a channel would mean every listener filtering out events meant
// for the other feature.
@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: corsOrigins(), credentials: true },
})
export class ChatGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    @Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier,
    private readonly users: UsersService,
  ) {}

  async handleConnection(client: Socket) {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      (client.handshake.query?.token as string | undefined);

    if (!token) {
      client.emit('unauthorized', { message: 'Потрібен токен авторизації' });
      client.disconnect(true);
      return;
    }

    try {
      const verified = await this.verifier.verify(token);
      const user = await this.users.findByFirebaseUid(verified.uid);

      if (!user) {
        client.disconnect(true);
        return;
      }

      await client.join(roomFor(user.id));
      client.emit('ready', { userId: user.id });
    } catch {
      client.emit('unauthorized', { message: 'Недійсний токен' });
      client.disconnect(true);
    }
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    if (!this.server) {
      this.logger.debug(`No socket server; dropped ${event} for ${userId}`);
      return;
    }

    this.server.to(roomFor(userId)).emit(event, payload);
  }
}

function roomFor(userId: string): string {
  return `user:${userId}`;
}
