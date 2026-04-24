import { startServer, } from './index';

async function main() {
  const { config } = await startServer({
    bootstrap: {
      hostDeviceName: 'Linqsy Host',
      sessionCode: 'DEMO42',
      sessionName: 'Demo transfer room',
      localHostUrl: 'http://127.0.0.1:4173',
      localJoinUrl: 'http://127.0.0.1:4173/join/DEMO42',
      lanJoinUrl: null,
    },
  });

  console.log(`Linqsy server listening on http://${config.host}:${config.port}`);
}

void main();