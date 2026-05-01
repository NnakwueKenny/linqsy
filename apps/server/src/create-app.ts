import {
  serverEventNames,
  sessionCodeSchema,
  type ErrorEnvelope,
  type Session,
  errorEnvelopeSchema,
  healthResponseSchema,
  transferResponseSchema,
  joinSessionRequestSchema,
  joinSessionResponseSchema,
  leaveSessionRequestSchema,
  transferListResponseSchema,
  cancelTransferRequestSchema,
  uploadTransferHeadersSchema,
  webPageBootstrapSchema,
  shutdownResponseSchema,
  type PageMode,
} from '@linqsy/shared';
import { Readable } from 'node:stream';
import type { AppConfig, } from '@linqsy/config';
import Fastify, { type FastifyReply, } from 'fastify';
import { RealtimeHub, } from './realtime/realtime-hub';
import { SessionService, } from './services/session-service';
import { TransferService, } from './services/transfer-service';
import type { BootstrapSessionInput, } from './services/session-service';
import { LocalTransferStorage, } from './storage/local-transfer-storage';
import { InMemorySessionStore, } from './stores/in-memory-session-store';
import { generateSessionCode, } from './lib/generate-identifiers';
import { loadWebAsset, renderWebClientDocument, } from './lib/web-client';


export type AppBootstrapContext = BootstrapSessionInput & {
  localHostUrl: string;
  localJoinUrl: string;
  lanJoinUrl: string | null;
};

type SessionCodeParams = {
  code: string;
};

type TransferIdParams = {
  transferId: string;
};

type TransferFailureCode =
  | 'device_not_found'
  | 'forbidden'
  | 'not_found'
  | 'session_ended'
  | 'unavailable';

const MAX_TRANSFER_BYTES = 10 * 1024 * 1024 * 1024;   // Maximum of 10 Gigabytes

function isValidationError(error: unknown): error is { issues: unknown } {
  return typeof error === 'object' && error !== null && 'issues' in error;
}

function createErrorEnvelope(
  code: string,
  message: string,
  details?: unknown,
): ErrorEnvelope {
  return errorEnvelopeSchema.parse({
    code,
    message,
    details,
  });
}

function getHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function getDecodedHeaderValue(value: string | string[] | undefined): string | undefined {
  const headerValue = getHeaderValue(value);

  if (!headerValue) {
    return undefined;
  }

  try {
    return decodeURIComponent(headerValue);
  } catch {
    return headerValue;
  }
}

function toReadableBody(body: unknown): Readable {
  if (body instanceof Readable) {
    return body;
  }

  if (body instanceof Uint8Array || typeof body === 'string') {
    return Readable.from(body);
  }

  throw new Error('Transfer payload is missing.');
}

function buildContentDisposition(filename: string): string {
  const safeFilename = filename.replace(/[\r\n"]/g, '_');
  const encodedFilename = encodeURIComponent(filename);

  return `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`;
}

function buildJoinUrl(hostUrl: string, sessionCode: string): string {
  return `${hostUrl}/join/${sessionCode}`;
}

function createBootstrapPayload(
  mode: PageMode,
  session: Session,
  bootstrap: AppBootstrapContext,
) {
  return webPageBootstrapSchema.parse({
    mode,
    session,
    joinUrl: bootstrap.lanJoinUrl ?? bootstrap.localJoinUrl,
    lanJoinUrl: bootstrap.lanJoinUrl,
    localHostUrl: bootstrap.localHostUrl,
    localJoinUrl: bootstrap.localJoinUrl,
  });
}

function createRestartBootstrap(currentBootstrap: AppBootstrapContext): AppBootstrapContext {
  const sessionCode = generateSessionCode().toUpperCase();
  const localJoinUrl = buildJoinUrl(currentBootstrap.localHostUrl, sessionCode);
  const lanHostUrl = currentBootstrap.lanJoinUrl ? new URL(currentBootstrap.lanJoinUrl).origin : null;

  return {
    ...currentBootstrap,
    sessionCode,
    localJoinUrl,
    lanJoinUrl: lanHostUrl ? buildJoinUrl(lanHostUrl, sessionCode) : null,
  };
}

function sendTransferFailure(
  reply: FastifyReply,
  code: TransferFailureCode,
  messages: {
    deviceNotFound: string;
    forbidden: string;
    notFound: string;
    sessionEnded: string;
    unavailable: string;
  },
) {
  if (code === 'device_not_found') {
    reply.code(409);
    return createErrorEnvelope('DEVICE_NOT_FOUND', messages.deviceNotFound);
  }

  if (code === 'forbidden') {
    reply.code(403);
    return createErrorEnvelope('TRANSFER_FORBIDDEN', messages.forbidden);
  }

  if (code === 'session_ended') {
    reply.code(409);
    return createErrorEnvelope('SESSION_ENDED', messages.sessionEnded);
  }

  if (code === 'unavailable') {
    reply.code(409);
    return createErrorEnvelope('TRANSFER_UNAVAILABLE', messages.unavailable);
  }

  reply.code(404);
  return createErrorEnvelope('TRANSFER_NOT_FOUND', messages.notFound);
}

export function createApp(config: AppConfig, bootstrap: AppBootstrapContext) {
  const app = Fastify({
    logger: {
      level: 'info',
    },
  });
  let activeBootstrap = bootstrap;

  const sessionStore = new InMemorySessionStore();
  const sessionService = new SessionService(sessionStore);
  const realtimeHub = new RealtimeHub({
    onConnect: (sessionCode, socket) => {
      const currentSession = sessionService.getSession(sessionCode);

      if (!currentSession) {
        socket.close(1008, 'Session not found');
        return;
      }

      socket.send(
        JSON.stringify({
          type: serverEventNames.session.state,
          payload: currentSession,
        }),
      );
    },
    onDisconnect: (sessionCode, deviceId) => {
      const currentSession = sessionService.getSession(sessionCode);

      if (!currentSession || currentSession.status === 'ended') {
        return;
      }

      const disconnectedDevice = currentSession.devices.find((device) => device.id === deviceId);

      if (!disconnectedDevice || disconnectedDevice.role !== 'client' || !disconnectedDevice.isOnline) {
        return;
      }

      const updatedSession = sessionService.leaveSession(sessionCode, { deviceId });

      if (updatedSession) {
        realtimeHub.broadcastDeviceLeft(updatedSession);
      }
    },
  });
  const transferService = new TransferService(
    sessionStore,
    new LocalTransferStorage(),
    {
      onSessionUpdated: (session) => {
        realtimeHub.broadcastSessionState(session);
      },
    },
  );

  sessionService.bootstrap(activeBootstrap);

  app.addContentTypeParser(
    'application/octet-stream',
    {
      bodyLimit: MAX_TRANSFER_BYTES,
    },
    (_request, payload, done) => {
      done(null, payload);
    },
  );

  app.setErrorHandler((error, request, reply) => {
    if (isValidationError(error)) {
      reply.code(400).send(
        createErrorEnvelope('VALIDATION_ERROR', 'Request validation failed.', {
          issues: error.issues,
        }),
      );
      return;
    }

    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'FST_ERR_CTP_BODY_TOO_LARGE'
    ) {
      reply
        .code(413)
        .send(createErrorEnvelope('TRANSFER_TOO_LARGE', 'That file is larger than Linqsy can accept.'));
      return;
    }

    request.log.error(
      {
        err: error instanceof Error ? error : new Error(String(error)),
      },
      'Unhandled server error',
    );
    reply.code(500).send(createErrorEnvelope('INTERNAL_ERROR', 'Unexpected server error.'));
  });

  app.get('/', async (_request, reply) => {
    const currentSession = sessionService.getCurrentSession();

    if (!currentSession) {
      reply.code(500);
      return createErrorEnvelope('SESSION_NOT_READY', 'Host session is not ready.');
    }

    reply.type('text/html; charset=utf-8');
    return await renderWebClientDocument(
      createBootstrapPayload('host', currentSession, activeBootstrap),
    );
  });

  app.get<{ Params: SessionCodeParams }>('/join/:code', async (request, reply) => {
    const code = sessionCodeSchema.parse(request.params.code.toUpperCase());
    const currentSession = sessionService.getSession(code);

    if (!currentSession) {
      reply.code(404);
      return createErrorEnvelope('SESSION_NOT_FOUND', 'This session is not available.');
    }

    reply.type('text/html; charset=utf-8');
    return await renderWebClientDocument(
      createBootstrapPayload(
        'receiver',
        currentSession,
        {
          ...activeBootstrap,
          localJoinUrl: buildJoinUrl(activeBootstrap.localHostUrl, code),
          lanJoinUrl: activeBootstrap.lanJoinUrl
            ? buildJoinUrl(new URL(activeBootstrap.lanJoinUrl).origin, code)
            : null,
        },
      ),
    );
  });

  app.get<{ Params: { '*': string } }>('/assets/*', async (request, reply) => {
    const assetPath = `assets/${request.params['*']}`;
    const asset = await loadWebAsset(assetPath);

    if (!asset) {
      reply.code(404);
      return createErrorEnvelope('ASSET_NOT_FOUND', 'The requested asset was not found.');
    }

    reply.type(asset.contentType);
    return reply.send(asset.content);
  });

  app.get('/api/health', async () => {
    return healthResponseSchema.parse({
      status: 'ok',
      service: 'linqsy-server',
      timestamp: new Date().toISOString(),
    });
  });

  app.get<{ Params: SessionCodeParams }>('/api/session/:code', async (request, reply) => {
    const code = sessionCodeSchema.parse(request.params.code.toUpperCase());
    const currentSession = sessionService.getSession(code);

    if (!currentSession) {
      reply.code(404);
      return createErrorEnvelope('SESSION_NOT_FOUND', 'This session does not exist.');
    }

    return currentSession;
  });

  app.get<{ Params: SessionCodeParams }>(
    '/api/session/:code/transfers',
    async (request, reply) => {
      const code = sessionCodeSchema.parse(request.params.code.toUpperCase());
      const transfers = transferService.listTransfers(code);

      if (!transfers) {
        reply.code(404);
        return createErrorEnvelope('SESSION_NOT_FOUND', 'This session does not exist.');
      }

      return transferListResponseSchema.parse(transfers);
    },
  );

  app.post<{ Params: SessionCodeParams }>('/api/session/:code/join', async (request, reply) => {
    const code = sessionCodeSchema.parse(request.params.code.toUpperCase());
    const existingSession = sessionService.getSession(code);

    if (!existingSession) {
      reply.code(404);
      return createErrorEnvelope('SESSION_NOT_FOUND', 'This session does not exist.');
    }

    if (existingSession.status === 'ended') {
      reply.code(409);
      return createErrorEnvelope('SESSION_ENDED', 'This session has already ended.');
    }

    const connectedClients = existingSession.devices.filter(
      (device) => device.role === 'client' && device.isOnline,
    );

    if (connectedClients.length >= 1) {
      reply.code(409);
      return createErrorEnvelope('SESSION_FULL', 'This room already has a connected receiver.');
    }

    const payload = joinSessionRequestSchema.parse(request.body);
    const joined = sessionService.joinSession(code, payload, request.headers['user-agent']);

    if (!joined) {
      reply.code(409);
      return createErrorEnvelope('SESSION_UNAVAILABLE', 'Unable to join this session.');
    }

    realtimeHub.broadcastDeviceJoined(joined.session);
    return joinSessionResponseSchema.parse(joined);
  });

  app.post<{ Params: SessionCodeParams }>('/api/session/:code/leave', async (request, reply) => {
    const code = sessionCodeSchema.parse(request.params.code.toUpperCase());
    const existingSession = sessionService.getSession(code);

    if (!existingSession) {
      reply.code(404);
      return createErrorEnvelope('SESSION_NOT_FOUND', 'This session does not exist.');
    }

    if (existingSession.status === 'ended') {
      reply.code(409);
      return createErrorEnvelope('SESSION_ENDED', 'This session has already ended.');
    }

    const payload = leaveSessionRequestSchema.parse(request.body);
    const updatedSession = sessionService.leaveSession(code, payload);

    if (!updatedSession) {
      reply.code(404);
      return createErrorEnvelope('SESSION_NOT_FOUND', 'This session does not exist.');
    }

    realtimeHub.broadcastDeviceLeft(updatedSession);
    return updatedSession;
  });

  app.post<{ Params: SessionCodeParams }>(
    '/api/session/:code/transfers/upload',
    {
      bodyLimit: MAX_TRANSFER_BYTES,
    },
    async (request, reply) => {
      const code = sessionCodeSchema.parse(request.params.code.toUpperCase());
      const payload = uploadTransferHeadersSchema.parse({
        deviceId: getHeaderValue(request.headers['x-linqsy-device-id']),
        filename: getDecodedHeaderValue(request.headers['x-linqsy-filename']),
        relativePath: getDecodedHeaderValue(request.headers['x-linqsy-relative-path']),
        mimeType:
          getHeaderValue(request.headers['x-linqsy-mime-type']) ?? 'application/octet-stream',
        size: getHeaderValue(request.headers['x-linqsy-size']),
      });

      const result = await transferService.uploadTransfer(code, {
        ...payload,
        stream: toReadableBody(request.body),
      });

      if (!result.ok) {
        return sendTransferFailure(reply, result.code, {
          deviceNotFound: 'The selected device is not part of this session.',
          forbidden: 'You cannot upload this transfer.',
          notFound: 'This session does not exist.',
          sessionEnded: 'This session has already ended.',
          unavailable: 'This transfer could not be uploaded.',
        });
      }

      return transferResponseSchema.parse(result.transfer);
    },
  );

  app.get<{ Params: TransferIdParams }>(
    '/api/transfers/:transferId/download',
    async (request, reply) => {
      const result = await transferService.prepareDownload(request.params.transferId);

      if (!result.ok) {
        return sendTransferFailure(reply, result.code, {
          deviceNotFound: 'This transfer is not attached to a joined device.',
          forbidden: 'You cannot download this transfer.',
          notFound: 'This transfer does not exist.',
          sessionEnded: 'This session has already ended.',
          unavailable: 'This transfer is not available for download.',
        });
      }

      let finalized = false;

      result.stream.once('end', () => {
        if (finalized) {
          return;
        }

        finalized = true;
        const completed = transferService.completeDownload(result.transfer.id);
        void completed;
      });

      result.stream.once('error', () => {
        if (finalized) {
          return;
        }

        finalized = true;
        const failed = transferService.failTransfer(result.transfer.id);
        void failed;
      });

      reply.raw.once('close', () => {
        if (finalized) {
          return;
        }

        finalized = true;
        const reset = transferService.resetDownload(result.transfer.id);
        void reset;
      });

      reply.header('content-disposition', buildContentDisposition(result.transfer.filename));
      reply.header('content-length', String(result.transfer.size));
      reply.type(result.transfer.mimeType || 'application/octet-stream');

      return reply.send(result.stream);
    },
  );

  app.post<{ Params: TransferIdParams }>('/api/transfers/:transferId/cancel', async (request, reply) => {
    const payload = cancelTransferRequestSchema.parse(request.body);
    const result = await transferService.cancelTransfer(request.params.transferId, payload);

    if (!result.ok) {
      return sendTransferFailure(reply, result.code, {
        deviceNotFound: 'This transfer is not attached to a joined device.',
        forbidden: 'Only the sender or host can cancel this transfer.',
        notFound: 'This transfer does not exist.',
        sessionEnded: 'This session has already ended.',
        unavailable: 'This transfer cannot be cancelled right now.',
      });
    }

    return transferResponseSchema.parse(result.transfer);
  });

  app.post('/api/host/restart', async () => {
    const currentSession = sessionService.getCurrentSession();

    if (currentSession) {
      const endedSession = sessionService.endSession(currentSession.code) ?? currentSession;
      realtimeHub.broadcastSessionEnded(endedSession);
      realtimeHub.closeSessionConnections(currentSession.code, 1001, 'Session restarted');
      await transferService.cleanupSession(currentSession.code);
    }

    activeBootstrap = createRestartBootstrap(activeBootstrap);
    const restartedSession = sessionService.bootstrap(activeBootstrap);

    return createBootstrapPayload('host', restartedSession, activeBootstrap);
  });

  app.post('/api/host/shutdown', async (_request, reply) => {
    const currentSession = sessionService.getCurrentSession();

    if (currentSession && currentSession.status !== 'ended') {
      const endedSession = sessionService.endSession(currentSession.code) ?? currentSession;
      realtimeHub.broadcastSessionEnded(endedSession);
      realtimeHub.closeSessionConnections(currentSession.code, 1001, 'Host stopped sharing');
      await transferService.cleanupSession(currentSession.code);
    }

    const payload = shutdownResponseSchema.parse({
      ok: true,
    });

    reply.send(payload);

    setTimeout(() => {
      void app.close();
    }, 40);
  });

  app.post<{ Params: SessionCodeParams }>('/api/session/:code/end', async (request, reply) => {
    const code = sessionCodeSchema.parse(request.params.code.toUpperCase());
    const existingSession = sessionService.getSession(code);

    if (!existingSession) {
      reply.code(404);
      return createErrorEnvelope('SESSION_NOT_FOUND', 'This session does not exist.');
    }

    if (existingSession.status === 'ended') {
      return existingSession;
    }

    const endedSession = sessionService.endSession(code);

    if (!endedSession) {
      reply.code(404);
      return createErrorEnvelope('SESSION_NOT_FOUND', 'This session does not exist.');
    }

    await transferService.cleanupSession(code);
    realtimeHub.broadcastSessionEnded(endedSession);
    realtimeHub.closeSessionConnections(code, 1001, 'Session ended');
    return endedSession;
  });

  app.addHook('onReady', async () => {
    await transferService.cleanupRoot();
    realtimeHub.attach(app.server);
  });

  app.addHook('onClose', async () => {
    const currentSession = sessionService.getCurrentSession();

    if (currentSession) {
      await transferService.cleanupSession(currentSession.code);
    }

    await realtimeHub.close();
  });

  return app;

}
