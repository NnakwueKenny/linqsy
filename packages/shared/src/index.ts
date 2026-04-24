import { z, } from 'zod';

export const sessionCodeSchema = z
  .string()
  .trim()
  .min(4)
  .max(12)
  .regex(/^[A-Z0-9-]+$/);

export const TRANSFER_STATUSES = [
  'ready',
  'queued',
  'failed',
  'uploading',
  'completed',
  'cancelled',
  'downloading',
] as const;

export const transferStatusSchema = z.enum(TRANSFER_STATUSES);
export type TransferStatus = z.infer<typeof transferStatusSchema>;

export const sessionStatusSchema = z.enum(['waiting', 'active', 'ended']);
export type SessionStatus = z.infer<typeof sessionStatusSchema>;

export const deviceRoleSchema = z.enum(['host', 'client']);
export type DeviceRole = z.infer<typeof deviceRoleSchema>;

export const deviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  isOnline: z.boolean(),
  role: deviceRoleSchema,
  userAgent: z.string().optional(),
  connectedAt: z.number().int().nonnegative(),
});

export type Device = z.infer<typeof deviceSchema>;

export const transferSchema = z.object({
  id: z.string(),
  mimeType: z.string(),
  filename: z.string(),
  relativePath: z.string().optional(),
  sessionId: z.string(),
  senderDeviceId: z.string(),
  status: transferStatusSchema,
  size: z.number().nonnegative(),
  bytesTransferred: z.number().nonnegative().default(0),
  progressPercent: z.number().min(0).max(100).default(0),
  speedBytesPerSecond: z.number().nonnegative().optional(),
  createdAt: z.number().int().nonnegative(),
});

export type Transfer = z.infer<typeof transferSchema>;

export const sessionSchema = z.object({
  id: z.string(),
  code: sessionCodeSchema,
  hostDeviceId: z.string(),
  name: z.string().optional(),
  status: sessionStatusSchema,
  devices: z.array(deviceSchema),
  transfers: z.array(transferSchema),
  createdAt: z.number().int().nonnegative(),
});

export type Session = z.infer<typeof sessionSchema>;

export const errorEnvelopeSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
  requestId: z.string().optional(),
});

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;

export const healthResponseSchema = z.object({
  timestamp: z.string(),
  status: z.literal('ok'),
  service: z.literal('linqsy-server'),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const joinSessionRequestSchema = z.object({
  deviceName: z.string().trim().min(1).max(80),
});

export type JoinSessionRequest = z.infer<typeof joinSessionRequestSchema>;

export const joinSessionResponseSchema = z.object({
  device: deviceSchema,
  session: sessionSchema,
});

export type JoinSessionResponse = z.infer<typeof joinSessionResponseSchema>;

export const leaveSessionRequestSchema = z.object({
  deviceId: z.string().trim().min(1),
});

export type LeaveSessionRequest = z.infer<typeof leaveSessionRequestSchema>;

export const uploadTransferHeadersSchema = z.object({
  deviceId: z.string().trim().min(1),
  filename: z.string().trim().min(1).max(240),
  relativePath: z.string().trim().max(800).optional(),
  mimeType: z.string().trim().min(1).max(160),
  size: z.coerce.number().int().nonnegative(),
});

export type UploadTransferHeaders = z.infer<typeof uploadTransferHeadersSchema>;

export const cancelTransferRequestSchema = z.object({
  deviceId: z.string().trim().min(1),
});

export type CancelTransferRequest = z.infer<typeof cancelTransferRequestSchema>;

export const pageModeSchema = z.enum(['host', 'receiver']);
export type PageMode = z.infer<typeof pageModeSchema>;

export const webPageBootstrapSchema = z.object({
  mode: pageModeSchema,
  session: sessionSchema,
  localHostUrl: z.string().url(),
  localJoinUrl: z.string().url(),
  lanJoinUrl: z.string().url().nullable(),
  joinUrl: z.string().url(),
});

export type WebPageBootstrap = z.infer<typeof webPageBootstrapSchema>;

export const shutdownResponseSchema = z.object({
  ok: z.literal(true),
});

export type ShutdownResponse = z.infer<typeof shutdownResponseSchema>;

export const transferResponseSchema = transferSchema;
export type TransferResponse = z.infer<typeof transferResponseSchema>;

export const transferListResponseSchema = z.array(transferSchema);
export type TransferListResponse = z.infer<typeof transferListResponseSchema>;

export const clientEventNames = {
  device: {
    hello: 'device:hello',
  },
  session: {
    join: 'session:join',
    leave: 'session:leave',
  },
  transfer: {
    create: 'transfer:create',
    cancel: 'transfer:cancel',
    downloaded: 'transfer:downloaded',
  },
} as const;

export const serverEventNames = {
  session: {
    state: 'session:state',
    ended: 'session:ended',
  },
  device: {
    left: 'device:left',
    joined: 'device:joined',
  },
  transfer: {
    ready: 'transfer:ready',
    failed: 'transfer:failed',
    created: 'transfer:created',
    cancelled: 'transfer:cancelled',
    progress: 'transfer:progress',
    completed: 'transfer:completed',
  },
} as const;
