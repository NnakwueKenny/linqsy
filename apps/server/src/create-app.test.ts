import type {
  Session,
  ErrorEnvelope,
  TransferResponse,
  JoinSessionResponse,
  TransferListResponse,
} from '@linqsy/shared';
import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { createApp, } from './create-app';
import { resolveAppConfig, } from '@linqsy/config';


function createTestApp() {
  return createApp(
    resolveAppConfig({
      port: 4173,
      host: '127.0.0.1',
      autoOpenBrowser: false,
    }),
    {
      lanJoinUrl: null,
      sessionCode: 'TEST42',
      sessionName: 'Test room',
      hostDeviceName: 'Test Host',
      localHostUrl: 'http://127.0.0.1:4173',
      localJoinUrl: 'http://127.0.0.1:4173/join/TEST42',
    },
  );
}

async function getCurrentSession(app: ReturnType<typeof createTestApp>) {
  const response = await app.inject({
    method: 'GET',
    url: '/api/session/TEST42',
  });

  assert.equal(response.statusCode, 200);
  return response.json() as Session;
}

async function waitForTransfer(
  app: ReturnType<typeof createTestApp>,
  predicate: (session: Session) => boolean,
) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const session = await getCurrentSession(app);

    if (predicate(session)) {
      return session;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 25);
    });
  }

  throw new Error('Timed out waiting for transfer state.');
}

test('bootstrapped session is available over HTTP', async (t) => {
  const app = createTestApp();
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: 'GET',
    url: '/api/session/TEST42',
  });

  assert.equal(response.statusCode, 200);

  const payload = response.json() as Session;

  assert.equal(payload.code, 'TEST42');
  assert.equal(payload.status, 'waiting');
  assert.equal(payload.devices.length, 1);
  assert.equal(payload.devices[0]?.role, 'host');
});

test('host page serves the web client bootstrap document', async (t) => {
  const app = createTestApp();
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: 'GET',
    url: '/',
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.headers['content-type'] ?? '', /text\/html/);
  assert.match(response.body, /__LINQSY_BOOTSTRAP__/);
  assert.match(response.body, /join\/TEST42/);
});

test('joining then leaving updates session presence', async (t) => {
  const app = createTestApp();
  t.after(async () => {
    await app.close();
  });

  const joinResponse = await app.inject({
    method: 'POST',
    url: '/api/session/TEST42/join',
    payload: {
      deviceName: 'Kene iPhone',
    },
  });

  assert.equal(joinResponse.statusCode, 200);

  const joinedPayload = joinResponse.json() as JoinSessionResponse;

  assert.equal(joinedPayload.session.status, 'active');
  assert.equal(joinedPayload.session.devices.length, 2);
  assert.equal(joinedPayload.device.name, 'Kene iPhone');

  const leaveResponse = await app.inject({
    method: 'POST',
    url: '/api/session/TEST42/leave',
    payload: {
      deviceId: joinedPayload.device.id,
    },
  });

  assert.equal(leaveResponse.statusCode, 200);

  const leftPayload = leaveResponse.json() as Session;

  assert.equal(leftPayload.status, 'waiting');
  assert.equal(leftPayload.devices.length, 1);
  assert.equal(leftPayload.devices[0]?.role, 'host');
});

test('ended sessions reject new joins', async (t) => {
  const app = createTestApp();
  t.after(async () => {
    await app.close();
  });

  const endResponse = await app.inject({
    method: 'POST',
    url: '/api/session/TEST42/end',
  });

  assert.equal(endResponse.statusCode, 200);

  const joinResponse = await app.inject({
    method: 'POST',
    url: '/api/session/TEST42/join',
    payload: {
      deviceName: 'Late device',
    },
  });

  assert.equal(joinResponse.statusCode, 409);

  const errorPayload = joinResponse.json() as ErrorEnvelope;

  assert.equal(errorPayload.code, 'SESSION_ENDED');
});

test('room only allows one connected receiver at a time', async (t) => {
  const app = createTestApp();
  t.after(async () => {
    await app.close();
  });

  const firstJoin = await app.inject({
    method: 'POST',
    url: '/api/session/TEST42/join',
    payload: {
      deviceName: 'First receiver',
    },
  });

  assert.equal(firstJoin.statusCode, 200);

  const secondJoin = await app.inject({
    method: 'POST',
    url: '/api/session/TEST42/join',
    payload: {
      deviceName: 'Second receiver',
    },
  });

  assert.equal(secondJoin.statusCode, 409);

  const errorPayload = secondJoin.json() as ErrorEnvelope;

  assert.equal(errorPayload.code, 'SESSION_FULL');
});

test('host can upload and download a transfer', async (t) => {
  const app = createTestApp();
  t.after(async () => {
    await app.close();
  });

  const session = await getCurrentSession(app);
  const fileContents = Buffer.from('hello from linqsy');

  const uploadResponse = await app.inject({
    method: 'POST',
    url: '/api/session/TEST42/transfers/upload',
    payload: fileContents,
    headers: {
      'content-type': 'application/octet-stream',
      'x-linqsy-device-id': session.hostDeviceId,
      'x-linqsy-filename': 'hello.txt',
      'x-linqsy-mime-type': 'text/plain',
      'x-linqsy-size': String(fileContents.length),
    },
  });

  assert.equal(uploadResponse.statusCode, 200);

  const uploadedTransfer = uploadResponse.json() as TransferResponse;

  assert.equal(uploadedTransfer.filename, 'hello.txt');
  assert.equal(uploadedTransfer.status, 'ready');

  const transferListResponse = await app.inject({
    method: 'GET',
    url: '/api/session/TEST42/transfers',
  });

  assert.equal(transferListResponse.statusCode, 200);

  const transfers = transferListResponse.json() as TransferListResponse;

  assert.equal(transfers.length, 1);
  assert.equal(transfers[0]?.id, uploadedTransfer.id);

  const downloadResponse = await app.inject({
    method: 'GET',
    url: `/api/transfers/${uploadedTransfer.id}/download`,
  });

  assert.equal(downloadResponse.statusCode, 200);
  assert.equal(downloadResponse.body, fileContents.toString());
  assert.match(downloadResponse.headers['content-disposition'] ?? '', /attachment/);

  await new Promise((resolve) => {
    setTimeout(resolve, 10);
  });

  const sessionAfterDownload = await getCurrentSession(app);
  const downloadedTransfer = sessionAfterDownload.transfers.find(
    (transfer) => transfer.id === uploadedTransfer.id,
  );

  assert.equal(downloadedTransfer?.status, 'completed');
});

test('host can upload a transfer larger than the default Fastify body limit', async (t) => {
  const app = createTestApp();
  t.after(async () => {
    await app.close();
  });

  const session = await getCurrentSession(app);
  const fileContents = Buffer.alloc((1024 * 1024) + 128, 'a');

  const uploadResponse = await app.inject({
    method: 'POST',
    url: '/api/session/TEST42/transfers/upload',
    payload: fileContents,
    headers: {
      'content-type': 'application/octet-stream',
      'x-linqsy-device-id': session.hostDeviceId,
      'x-linqsy-filename': 'large.bin',
      'x-linqsy-mime-type': 'application/octet-stream',
      'x-linqsy-size': String(fileContents.length),
    },
  });

  assert.equal(uploadResponse.statusCode, 200);

  const uploadedTransfer = uploadResponse.json() as TransferResponse;

  assert.equal(uploadedTransfer.filename, 'large.bin');
  assert.equal(uploadedTransfer.size, fileContents.length);
  assert.equal(uploadedTransfer.status, 'ready');
});

test('receiver can download while sender upload is still streaming', async (t) => {
  const app = createTestApp();
  t.after(async () => {
    await app.close();
  });

  const session = await getCurrentSession(app);
  const joinResponse = await app.inject({
    method: 'POST',
    url: '/api/session/TEST42/join',
    payload: {
      deviceName: 'Live receiver',
    },
  });

  assert.equal(joinResponse.statusCode, 200);

  const fileContents = Buffer.from('hello from live relay');
  const uploadStream = new PassThrough();
  const uploadResponsePromise = app.inject({
    method: 'POST',
    url: '/api/session/TEST42/transfers/upload',
    payload: uploadStream,
    headers: {
      'content-type': 'application/octet-stream',
      'x-linqsy-device-id': session.hostDeviceId,
      'x-linqsy-filename': 'live.txt',
      'x-linqsy-mime-type': 'text/plain',
      'x-linqsy-size': String(fileContents.length),
    },
  });

  const queuedSession = await waitForTransfer(app, (currentSession) =>
    currentSession.transfers.some((transfer) => transfer.filename === 'live.txt'),
  );
  const liveTransfer = queuedSession.transfers.find((transfer) => transfer.filename === 'live.txt');

  assert.equal(liveTransfer?.status, 'queued');

  const downloadResponsePromise = app.inject({
    method: 'GET',
    url: `/api/transfers/${liveTransfer?.id}/download`,
  });

  uploadStream.end(fileContents);

  const [uploadResponse, downloadResponse] = await Promise.all([
    uploadResponsePromise,
    downloadResponsePromise,
  ]);

  assert.equal(uploadResponse.statusCode, 200);
  assert.equal(downloadResponse.statusCode, 200);
  assert.equal(downloadResponse.body, fileContents.toString());

  await new Promise((resolve) => {
    setTimeout(resolve, 10);
  });

  const completedSession = await getCurrentSession(app);
  const completedTransfer = completedSession.transfers.find(
    (transfer) => transfer.id === liveTransfer?.id,
  );

  assert.equal(completedTransfer?.status, 'completed');
});

test('host can cancel a transfer and it becomes unavailable', async (t) => {
  const app = createTestApp();
  t.after(async () => {
    await app.close();
  });

  const session = await getCurrentSession(app);
  const fileContents = Buffer.from('cancel me');

  const uploadResponse = await app.inject({
    method: 'POST',
    url: '/api/session/TEST42/transfers/upload',
    payload: fileContents,
    headers: {
      'content-type': 'application/octet-stream',
      'x-linqsy-device-id': session.hostDeviceId,
      'x-linqsy-filename': 'cancel.txt',
      'x-linqsy-mime-type': 'text/plain',
      'x-linqsy-size': String(fileContents.length),
    },
  });

  assert.equal(uploadResponse.statusCode, 200);

  const uploadedTransfer = uploadResponse.json() as TransferResponse;

  const cancelResponse = await app.inject({
    method: 'POST',
    url: `/api/transfers/${uploadedTransfer.id}/cancel`,
    payload: {
      deviceId: session.hostDeviceId,
    },
  });

  assert.equal(cancelResponse.statusCode, 200);

  const cancelledTransfer = cancelResponse.json() as TransferResponse;

  assert.equal(cancelledTransfer.status, 'cancelled');

  const downloadResponse = await app.inject({
    method: 'GET',
    url: `/api/transfers/${uploadedTransfer.id}/download`,
  });

  assert.equal(downloadResponse.statusCode, 409);

  const errorPayload = downloadResponse.json() as ErrorEnvelope;

  assert.equal(errorPayload.code, 'TRANSFER_UNAVAILABLE');
});

test('host can restart into a fresh session from the browser API', async (t) => {
  const app = createTestApp();
  t.after(async () => {
    await app.close();
  });

  const restartResponse = await app.inject({
    method: 'POST',
    url: '/api/host/restart',
  });

  assert.equal(restartResponse.statusCode, 200);

  const payload = restartResponse.json() as {
    joinUrl: string;
    localJoinUrl: string;
    mode: 'host';
    session: Session;
  };

  assert.equal(payload.mode, 'host');
  assert.notEqual(payload.session.code, 'TEST42');
  assert.match(payload.localJoinUrl, new RegExp(`/join/${payload.session.code}$`));
  assert.match(payload.joinUrl, /\/join\//);

  const oldSessionResponse = await app.inject({
    method: 'GET',
    url: '/api/session/TEST42',
  });

  assert.equal(oldSessionResponse.statusCode, 404);

  const newSessionResponse = await app.inject({
    method: 'GET',
    url: `/api/session/${payload.session.code}`,
  });

  assert.equal(newSessionResponse.statusCode, 200);
});
