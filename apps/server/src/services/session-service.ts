import type {
  Device,
  Session,
  SessionStatus,
  JoinSessionRequest,
  LeaveSessionRequest,
} from '@linqsy/shared';
import { sessionSchema } from '@linqsy/shared';
import type { SessionStore } from '../stores/session-store';
import { generateId, generateSessionCode, } from '../lib/generate-identifiers';


export type BootstrapSessionInput = {
  hostDeviceName: string;
  hostUserAgent?: string;
  sessionCode?: string;
  sessionName?: string;
};

export class SessionService {

  constructor(private readonly store: SessionStore) {}

  bootstrap(input: BootstrapSessionInput): Session {
    const hostDevice: Device = {
      id: generateId(),
      name: input.hostDeviceName,
      role: 'host',
      userAgent: input.hostUserAgent,
      connectedAt: Date.now(),
      isOnline: true,
    };

    const session = sessionSchema.parse({
      id: generateId(),
      code: (input.sessionCode ?? generateSessionCode()).toUpperCase(),
      name: input.sessionName,
      hostDeviceId: hostDevice.id,
      createdAt: Date.now(),
      status: 'waiting',
      devices: [hostDevice],
      transfers: [],
    });

    return this.store.save(session);
  }

  getCurrentSession(): Session | null {
    return this.store.getCurrent();
  }

  getSession(code: string): Session | null {
    return this.store.getByCode(code.toUpperCase());
  }

  joinSession(code: string, input: JoinSessionRequest, userAgent?: string) {
    const session = this.getSession(code);

    if (!session || session.status === 'ended') {
      return null;
    }

    const device: Device = {
      id: generateId(),
      name: input.deviceName,
      role: 'client',
      userAgent,
      connectedAt: Date.now(),
      isOnline: true,
    };

    const updatedSession = sessionSchema.parse({
      ...session,
      status: this.resolveSessionStatus(session.devices.length + 1),
      devices: [...session.devices, device],
    });

    return {
      device,
      session: this.store.save(updatedSession),
    };
  }

  leaveSession(code: string, input: LeaveSessionRequest): Session | null {
    const session = this.getSession(code);

    if (!session || session.status === 'ended') {
      return null;
    }

    const remainingDevices = session.devices.filter(
      (device) => device.id !== input.deviceId || device.role === 'host',
    );

    if (remainingDevices.length === session.devices.length) {
      return session;
    }

    const updatedSession = sessionSchema.parse({
      ...session,
      status: this.resolveSessionStatus(remainingDevices.length),
      devices: remainingDevices,
    });

    return this.store.save(updatedSession);
  }

  endSession(code: string): Session | null {
    const session = this.getSession(code);

    if (!session) {
      return null;
    }

    const endedSession = sessionSchema.parse({
      ...session,
      status: 'ended',
    });

    return this.store.save(endedSession);
  }

  private resolveSessionStatus(deviceCount: number): SessionStatus {
    return deviceCount > 1 ? 'active' : 'waiting';
  }
}
