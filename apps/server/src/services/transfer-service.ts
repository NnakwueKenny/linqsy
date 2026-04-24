import type {
  Session,
  Transfer,
  TransferStatus,
  CancelTransferRequest,
  UploadTransferHeaders,
} from '@linqsy/shared';
import { Readable, Transform, } from 'node:stream';
import { generateId } from '../lib/generate-identifiers';
import { sessionSchema, transferSchema } from '@linqsy/shared';
import type { SessionStore } from '../stores/session-store';
import type { TransferStorage } from '../storage/transfer-storage';


type TransferContext = {
  session: Session;
  transfer: Transfer;
};

type TransferSuccess = {
  ok: true;
  session: Session;
  transfer: Transfer;
};

type TransferFailureCode =
  | 'forbidden'
  | 'not_found'
  | 'unavailable'
  | 'session_ended'
  | 'device_not_found'

type TransferFailure = {
  ok: false;
  code: TransferFailureCode;
};

type DownloadPreparation = TransferSuccess & {
  stream: Readable;
};

type TransferServiceHooks = {
  onSessionUpdated?: (session: Session) => void;
};

export class TransferService {
  constructor(
    private readonly store: SessionStore,
    private readonly storage: TransferStorage,
    private readonly hooks: TransferServiceHooks = {},
  ) {}

  async cleanupRoot(): Promise<void> {
    await this.storage.cleanupRoot();
  }

  async cleanupSession(sessionCode: string): Promise<void> {
    await this.storage.cleanupSession(sessionCode);
  }

  listTransfers(code: string): Transfer[] | null {
    const session = this.store.getByCode(code.toUpperCase());

    if (!session) {
      return null;
    }

    return session.transfers;
  }

  async uploadTransfer(
    code: string,
    input: UploadTransferHeaders & { stream: Readable },
  ): Promise<TransferSuccess | TransferFailure> {
    const session = this.store.getByCode(code.toUpperCase());

    if (!session) {
      return {
        ok: false,
        code: 'not_found',
      };
    }

    if (session.status === 'ended') {
      return {
        ok: false,
        code: 'session_ended',
      };
    }

    const sender = session.devices.find(
      (device) => device.id === input.deviceId && device.isOnline,
    );

    if (!sender) {
      return {
        ok: false,
        code: 'device_not_found',
      };
    }

    const transfer = transferSchema.parse({
      id: generateId(),
      status: 'queued',
      size: input.size,
      sessionId: session.id,
      createdAt: Date.now(),
      filename: input.filename,
      relativePath: input.relativePath,
      mimeType: input.mimeType,
      senderDeviceId: sender.id,
      bytesTransferred: 0,
      progressPercent: 0,
    });

    let currentSession = this.saveSession({
      ...session,
      transfers: [transfer, ...session.transfers],
    });

    currentSession = this.setTransferStatus(currentSession, transfer.id, 'uploading');
    const uploadTracker = this.createProgressStream(
      currentSession.code,
      transfer.id,
      input.size,
    );

    try {
      const meteredStream = input.stream.pipe(
        new Transform({
          transform(chunk, _encoding, callback) {
            const size = Buffer.isBuffer(chunk)
              ? chunk.byteLength
              : Buffer.byteLength(String(chunk));
            uploadTracker.track(size);
            callback(null, chunk);
          },
          flush(callback) {
            uploadTracker.finish();
            callback();
          },
        }),
      );

      await this.storage.writeTransferFile(currentSession.code, transfer.id, meteredStream);
      currentSession = this.setTransferStatus(currentSession, transfer.id, 'ready');
      return this.createSuccess(currentSession, transfer.id);
    } catch (error) {
      currentSession = this.setTransferStatus(currentSession, transfer.id, 'failed');
      await this.storage.deleteTransferFile(currentSession.code, transfer.id).catch(() => undefined);
      throw error;
    }
  }

  async prepareDownload(transferId: string): Promise<DownloadPreparation | TransferFailure> {
    const context = this.findTransferContext(transferId);

    if (!context) {
      return {
        ok: false,
        code: 'not_found',
      };
    }

    if (
      context.session.status === 'ended' ||
      context.transfer.status === 'cancelled' ||
      context.transfer.status === 'failed'
    ) {
      return {
        ok: false,
        code: 'unavailable',
      };
    }

    let currentSession = context.session;

    if (context.transfer.status === 'ready') {
      currentSession = this.setTransferStatus(currentSession, transferId, 'downloading');
    }

    try {
      const sourceStream = await this.storage.createTransferReadStream(currentSession.code, transferId);
      const downloadStream = this.createProgressStream(
        currentSession.code,
        transferId,
        context.transfer.size,
      );
      const stream = sourceStream.pipe(
        new Transform({
          transform(chunk, _encoding, callback) {
            const size = Buffer.isBuffer(chunk)
              ? chunk.byteLength
              : Buffer.byteLength(String(chunk));
            downloadStream.track(size);
            callback(null, chunk);
          },
          flush(callback) {
            downloadStream.finish();
            callback();
          },
        }),
      );
      const success = this.createSuccess(currentSession, transferId);

      return {
        ...success,
        stream,
      };
    } catch {
      this.setTransferStatus(currentSession, transferId, 'failed');
      return {
        ok: false,
        code: 'unavailable',
      };
    }
  }

  async cancelTransfer(
    transferId: string,
    input: CancelTransferRequest,
  ): Promise<TransferSuccess | TransferFailure> {
    const context = this.findTransferContext(transferId);

    if (!context) {
      return {
        ok: false,
        code: 'not_found',
      };
    }

    if (context.session.status === 'ended') {
      return {
        ok: false,
        code: 'session_ended',
      };
    }

    const mayCancel =
      input.deviceId === context.transfer.senderDeviceId ||
      input.deviceId === context.session.hostDeviceId;

    if (!mayCancel) {
      return {
        ok: false,
        code: 'forbidden',
      };
    }

    if (context.transfer.status !== 'cancelled') {
      await this.storage.deleteTransferFile(context.session.code, transferId).catch(() => undefined);
    }

    const session = this.setTransferStatus(context.session, transferId, 'cancelled');
    return this.createSuccess(session, transferId);
  }

  completeDownload(transferId: string): TransferSuccess | TransferFailure {
    return this.updateTransferLifecycleStatus(transferId, 'completed');
  }

  failTransfer(transferId: string): TransferSuccess | TransferFailure {
    return this.updateTransferLifecycleStatus(transferId, 'failed');
  }

  private updateTransferLifecycleStatus(
    transferId: string,
    status: Extract<TransferStatus, 'completed' | 'failed'>,
  ): TransferSuccess | TransferFailure {
    const context = this.findTransferContext(transferId);

    if (!context) {
      return {
        ok: false,
        code: 'not_found',
      };
    }

    const session = this.setTransferStatus(context.session, transferId, status);
    return this.createSuccess(session, transferId);
  }

  private createSuccess(session: Session, transferId: string): TransferSuccess {
    const transfer = session.transfers.find((item) => item.id === transferId);

    if (!transfer) {
      throw new Error(`Transfer ${transferId} is missing from session ${session.code}.`);
    }

    return {
      ok: true,
      session,
      transfer,
    };
  }

  private findTransferContext(transferId: string): TransferContext | null {
    const session = this.store.getCurrent();

    if (!session) {
      return null;
    }

    const transfer = session.transfers.find((item) => item.id === transferId);

    if (!transfer) {
      return null;
    }

    return {
      session,
      transfer,
    };
  }

  private saveSession(session: Session): Session {
    const savedSession = this.store.save(sessionSchema.parse(session));
    this.hooks.onSessionUpdated?.(savedSession);
    return savedSession;
  }

  private setTransferStatus(
    session: Session,
    transferId: string,
    status: TransferStatus,
  ): Session {
    const transfers = session.transfers.map((transfer) =>
      transfer.id === transferId
        ? transferSchema.parse({
            ...transfer,
            status,
            bytesTransferred:
              status === 'ready' || status === 'queued'
                ? 0
                : status === 'completed'
                  ? transfer.size
                  : transfer.bytesTransferred ?? 0,
            progressPercent:
              status === 'ready' || status === 'queued'
                ? 0
                : status === 'completed'
                  ? 100
                  : transfer.progressPercent ?? 0,
            speedBytesPerSecond:
              status === 'uploading' || status === 'downloading'
                ? transfer.speedBytesPerSecond ?? 0
                : 0,
          })
        : transfer,
    );

    return this.saveSession({
      ...session,
      transfers,
    });
  }

  private updateTransferMetrics(
    session: Session,
    transferId: string,
    input: {
      bytesTransferred: number;
      progressPercent: number;
      speedBytesPerSecond: number;
    },
  ): Session {
    const transfers = session.transfers.map((transfer) =>
      transfer.id === transferId
        ? transferSchema.parse({
            ...transfer,
            bytesTransferred: Math.min(transfer.size, Math.max(0, input.bytesTransferred)),
            progressPercent: Math.min(100, Math.max(0, input.progressPercent)),
            speedBytesPerSecond: Math.max(0, input.speedBytesPerSecond),
          })
        : transfer,
    );

    return this.saveSession({
      ...session,
      transfers,
    });
  }

  private createProgressStream(sessionCode: string, transferId: string, totalSize: number) {
    let transferredBytes = 0;
    let lastMeasuredBytes = 0;
    let lastMeasuredAt = Date.now();
    let lastPushedAt = 0;

    const pushMetrics = (force = false) => {
      const now = Date.now();

      if (!force && now - lastPushedAt < 120) {
        return;
      }

      const elapsed = Math.max(1, now - lastMeasuredAt);
      const bytesDelta = transferredBytes - lastMeasuredBytes;
      const speedBytesPerSecond = Math.round((bytesDelta * 1000) / elapsed);
      const session = this.store.getByCode(sessionCode.toUpperCase());

      if (!session) {
        return;
      }

      this.updateTransferMetrics(session, transferId, {
        bytesTransferred: transferredBytes,
        progressPercent:
          totalSize <= 0 ? 0 : Math.round((transferredBytes / totalSize) * 100),
        speedBytesPerSecond,
      });

      lastMeasuredBytes = transferredBytes;
      lastMeasuredAt = now;
      lastPushedAt = now;
    };

    return {
      track: (chunkSize: number) => {
        transferredBytes += chunkSize;
        pushMetrics(false);
      },
      finish: () => {
        pushMetrics(true);
      },
    };
  }
}
