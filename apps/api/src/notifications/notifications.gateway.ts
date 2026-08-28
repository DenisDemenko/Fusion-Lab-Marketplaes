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

// Push side of notifications. The REST list endpoint is the source of
// truth — a socket is a nice-to-have that can be missing (tab asleep,
// proxy dropped the upgrade), so nothing is *only* delivered here.
@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: corsOrigins(), credentials: true },
})
export class NotificationsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    @Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier,
    private readonly users: UsersService,
  ) {}

  // A websocket carries no Authorization header, so the client passes the
  // same Firebase ID token in the handshake. An unauthenticated socket is
  // disconnected rather than left open and silent: otherwise the frontend
  // would show a connected badge while receiving nothing forever.
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
    // The gateway is optional infrastructure: in unit tests and in a
    // process where the adapter failed to start, `server` is undefined and
    // a notification must still be persisted rather than throwing.
    if (!this.server) {
      this.logger.debug(`No socket server; dropped ${event} for ${userId}`);
      return;
    }

    this.server.to(roomFor(userId)).emit(event, payload);
  }
}

export function roomFor(userId: string): string {
  return `user:${userId}`;
}
