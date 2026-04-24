import type { Session, } from '@linqsy/shared';
import { WebSocketServer, WebSocket } from 'ws';
import { serverEventNames, } from '@linqsy/shared';
import type { IncomingMessage, Server, } from 'node:http';


type RealtimeEvent =
  | {
    payload: Session;
    type: typeof serverEventNames.session.state;
  }
  | {
    payload: Session;
    type: typeof serverEventNames.device.joined | typeof serverEventNames.device.left;
  }
  | {
    payload: Session;
    type: typeof serverEventNames.session.ended;
  };

type RealtimeHubOptions = {
  onConnect: (sessionCode: string, socket: WebSocket) => void;
  onDisconnect?: (sessionCode: string, deviceId: string) => void;
};

export class RealtimeHub {

  private readonly server: WebSocketServer;
  private readonly socketsBySession = new Map<string, Set<WebSocket>>();

  constructor(private readonly options: RealtimeHubOptions) {

    this.server = new WebSocketServer({
      noServer: true,
    });

    this.server.on('connection', (socket, request) => {
      const sessionCode = this.extractSessionCode(request);
      const deviceId = this.extractDeviceId(request);

      if (!sessionCode) {
        socket.close(1008, 'Session code is required');
        return;
      }

      const sessionSockets = this.socketsBySession.get(sessionCode) ?? new Set<WebSocket>();
      sessionSockets.add(socket);
      this.socketsBySession.set(sessionCode, sessionSockets);

      socket.on('close', () => {
        const currentSockets = this.socketsBySession.get(sessionCode);

        if (!currentSockets) {
          return;
        }

        currentSockets.delete(socket);

        if (currentSockets.size === 0) {
          this.socketsBySession.delete(sessionCode);
        }

        if (deviceId) {
          this.options.onDisconnect?.(sessionCode, deviceId);
        }
      });

      this.options.onConnect(sessionCode, socket);
    });
  }

  attach(server: Server) {
    server.on('upgrade', (request, socket, head) => {
      if (!request.url?.startsWith('/ws')) {
        return;
      }

      this.server.handleUpgrade(request, socket, head, (websocket) => {
        this.server.emit('connection', websocket, request);
      });
    });
  }

  broadcastSessionState(session: Session) {
    this.broadcast(session.code, {
      type: serverEventNames.session.state,
      payload: session,
    });
  }

  broadcastDeviceJoined(session: Session) {
    this.broadcast(session.code, {
      type: serverEventNames.device.joined,
      payload: session,
    });
  }

  broadcastDeviceLeft(session: Session) {
    this.broadcast(session.code, {
      type: serverEventNames.device.left,
      payload: session,
    });
  }

  broadcastSessionEnded(session: Session) {
    this.broadcast(session.code, {
      type: serverEventNames.session.ended,
      payload: session,
    });
  }

  closeSessionConnections(sessionCode: string, code = 1000, reason = 'Session closed') {
    const sockets = this.socketsBySession.get(sessionCode);

    if (!sockets) {
      return;
    }

    for (const socket of sockets) {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(code, reason);
      }
    }

    this.socketsBySession.delete(sessionCode);
  }

  close() {
    return new Promise<void>((resolve, reject) => {
      this.server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  private broadcast(sessionCode: string, event: RealtimeEvent) {
    const sockets = this.socketsBySession.get(sessionCode);

    if (!sockets) {
      return;
    }

    const payload = JSON.stringify(event);

    for (const socket of sockets) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
      }
    }
  }

  private extractSessionCode(request: IncomingMessage): string | null {
    const url = this.getRequestUrl(request);
    const code = url?.searchParams.get('code');

    return code ? code.toUpperCase() : null;
  }

  private extractDeviceId(request: IncomingMessage): string | null {
    const url = this.getRequestUrl(request);
    const deviceId = url?.searchParams.get('deviceId');

    return deviceId || null;
  }

  private getRequestUrl(request: IncomingMessage): URL | null {
    const baseUrl = `http://${request.headers.host ?? '127.0.0.1'}`;
    return request.url ? new URL(request.url, baseUrl) : null;
  }

}
