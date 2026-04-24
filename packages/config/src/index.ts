import { z } from 'zod';

export const appMeta = {
  name: 'linqsy',
  version: '0.1.0',
} as const;

export const appConfigSchema = z.object({
  host: z.string().default('0.0.0.0'),
  port: z.number().int().min(1).max(65535).default(4173),
  autoOpenBrowser: z.boolean().default(true),
  sessionName: z.string().min(1).max(80).optional(),
});

export type AppConfig = z.infer<typeof appConfigSchema>;

export const DEFAULT_APP_CONFIG: AppConfig = appConfigSchema.parse({});

export function resolveAppConfig(input: Partial<AppConfig> = {}): AppConfig {
  return appConfigSchema.parse({
    ...DEFAULT_APP_CONFIG,
    ...input,
  });
}
