import type { Readable } from 'node:stream';

export interface TransferStorage {
  cleanupRoot(): Promise<void>;
  cleanupSession(sessionCode: string): Promise<void>;
  createTransferReadStream(sessionCode: string, transferId: string): Promise<Readable>;
  deleteTransferFile(sessionCode: string, transferId: string): Promise<void>;
  writeTransferFile(sessionCode: string, transferId: string, stream: Readable): Promise<void>;
}
