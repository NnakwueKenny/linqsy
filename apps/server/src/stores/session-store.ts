import type { Session } from '@linqsy/shared';

export interface SessionStore {
  getCurrent(): Session | null;
  getByCode(code: string): Session | null;
  save(session: Session): Session;
}
