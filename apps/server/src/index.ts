import { resolveAppConfig, type AppConfig, } from '@linqsy/config';
import { createApp, type AppBootstrapContext, } from './create-app';


export { createApp, type AppBootstrapContext, } from './create-app';

export type StartServerInput = {
  config?: Partial<AppConfig>;
  bootstrap: AppBootstrapContext;
};

export async function startServer(input: StartServerInput) {

  const config = resolveAppConfig(input.config);
  const app = createApp(config, input.bootstrap);

  await app.listen({
    host: config.host,
    port: config.port,
  });

  return {
    app,
    config,
  };

}