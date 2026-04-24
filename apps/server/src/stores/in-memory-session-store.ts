import type { Session } from '@linqsy/shared';
import type { SessionStore } from './session-store';

export class InMemorySessionStore implements SessionStore {
  private currentSession: Session | null = null;

  getCurrent(): Session | null {
    return this.currentSession;
  }

  getByCode(code: string): Session | null {
    if (!this.currentSession || this.currentSession.code !== code) {
      return null;
    }

    return this.currentSession;
  }

  save(session: Session): Session {
    this.currentSession = session;
    return session;
  }
}
