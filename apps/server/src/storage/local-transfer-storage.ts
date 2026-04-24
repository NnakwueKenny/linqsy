import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { tmpdir } from 'node:os';
import type { TransferStorage } from './transfer-storage';

export class LocalTransferStorage implements TransferStorage {

  constructor(private readonly rootDir = join(tmpdir(), 'linqsy-transfer-storage')) {}

  async cleanupRoot(): Promise<void> {
    await rm(this.rootDir, {
      recursive: true,
      force: true,
    });

    await mkdir(this.rootDir, {
      recursive: true,
    });
  }

  async cleanupSession(sessionCode: string): Promise<void> {
    await rm(this.getSessionDir(sessionCode), {
      recursive: true,
      force: true,
    });
  }

  async createTransferReadStream(sessionCode: string, transferId: string): Promise<Readable> {
    return createReadStream(this.getTransferPath(sessionCode, transferId));
  }

  async deleteTransferFile(sessionCode: string, transferId: string): Promise<void> {
    await rm(this.getTransferPath(sessionCode, transferId), {
      force: true,
    });
  }

  async writeTransferFile(sessionCode: string, transferId: string, stream: Readable): Promise<void> {
    const sessionDir = this.getSessionDir(sessionCode);

    await mkdir(sessionDir, {
      recursive: true,
    });

    await pipeline(stream, createWriteStream(this.getTransferPath(sessionCode, transferId)));
  }

  private getSessionDir(sessionCode: string): string {
    return join(this.rootDir, sessionCode.toUpperCase());
  }

  private getTransferPath(sessionCode: string, transferId: string): string {
    return join(this.getSessionDir(sessionCode), transferId);
  }
}
