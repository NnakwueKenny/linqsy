/// <reference types="vite/client" />

import type { WebPageBootstrap } from '@linqsy/shared';

declare global {
  interface Window {
    __LINQSY_BOOTSTRAP__?: WebPageBootstrap;
  }
}
