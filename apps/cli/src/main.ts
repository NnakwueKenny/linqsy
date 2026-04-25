#!/usr/bin/env node

import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { hostname, networkInterfaces } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { appMeta, resolveAppConfig } from '@linqsy/config';
import { startServer, type AppBootstrapContext } from '@linqsy/server';


type CliFlags = {
  code?: string;
  host?: string;
  name?: string;
  port?: number;
  noOpen: boolean;
};

const SUPPORTED_COMMANDS = new Set(['start', 'doctor', 'version']);
const SESSION_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';


function parseFlags(args: string[]): CliFlags {
  const flags: CliFlags = {
    noOpen: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (token === '--no-open') {
      flags.noOpen = true;
      continue;
    }

    if (token === '--host') {
      const host = args[index + 1];

      if (host) {
        flags.host = host;
        index += 1;
      }

      continue;
    }

    if (token === '--name') {
      const name = args[index + 1];

      if (name) {
        flags.name = name;
        index += 1;
      }

      continue;
    }

    if (token === '--code') {
      const code = args[index + 1];

      if (code) {
        flags.code = code.toUpperCase();
        index += 1;
      }

      continue;
    }

    if (token === '--port') {
      const value = args[index + 1];
      const parsed = value ? Number.parseInt(value, 10) : Number.NaN;

      if (!Number.isNaN(parsed)) {
        flags.port = parsed;
        index += 1;
      }
    }
  }

  return flags;
}

function generateSessionCode(length = 6): string {
  const bytes = randomBytes(length);
  let output = '';

  for (let index = 0; index < length; index += 1) {
    const byte = bytes[index] ?? 0;
    output += SESSION_CODE_ALPHABET[byte % SESSION_CODE_ALPHABET.length] ?? 'A';
  }

  return output;
}

function detectLanIp(): string | null {
  const interfaces = networkInterfaces();

  for (const addresses of Object.values(interfaces)) {
    if (!addresses) {
      continue;
    }

    for (const address of addresses) {
      if (address.family === 'IPv4' && !address.internal) {
        return address.address;
      }
    }
  }

  return null;
}

function openBrowser(url: string) {
  const command =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'cmd'
        : 'xdg-open';

  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];

  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
  });

  child.unref();
}

async function runStart(args: string[]) {
  const flags = parseFlags(args);
  const configInput: Parameters<typeof resolveAppConfig>[0] = {
    autoOpenBrowser: !flags.noOpen,
  };

  if (flags.host) {
    configInput.host = flags.host;
  }

  if (typeof flags.port === 'number') {
    configInput.port = flags.port;
  }

  const config = resolveAppConfig(configInput);
  const sessionCode = flags.code ?? generateSessionCode();
  const hostDeviceName = flags.name ?? hostname();
  const lanIp = detectLanIp();
  const localHostUrl = `http://127.0.0.1:${config.port}`;
  const localJoinUrl = `${localHostUrl}/join/${sessionCode}`;
  const lanJoinUrl = lanIp ? `http://${lanIp}:${config.port}/join/${sessionCode}` : null;
  const bootstrap: AppBootstrapContext = {
    lanJoinUrl,
    sessionCode,
    localHostUrl,
    localJoinUrl,
    hostDeviceName,
  };

  if (config.sessionName) {
    bootstrap.sessionName = config.sessionName;
  }

  const { app } = await startServer({
    config,
    bootstrap,
  });
  let exiting = false;

  const exitProcess = (code: number) => {
    if (exiting) {
      return;
    }

    exiting = true;
    process.exit(code);
  };

  app.server.once('close', () => {
    exitProcess(0);
  });

  console.log('Linqsy host waiting room is running.');
  console.log(`Session code: ${sessionCode}`);
  console.log(`Host page: ${localHostUrl}`);
  console.log(`Local join URL: ${localJoinUrl}`);
  console.log(`LAN join URL: ${lanJoinUrl ?? 'Unavailable'}`);
  console.log(`Health: ${localHostUrl}/api/health`);
  console.log(`WebSocket: ${localHostUrl}/ws?code=${sessionCode}`);

  if (config.autoOpenBrowser) {
    openBrowser(localHostUrl);
  }

  const shutdown = async () => {
    await app.close();
    exitProcess(0);
  };

  process.once('SIGINT', () => {
    void shutdown();
  });

  process.once('SIGTERM', () => {
    void shutdown();
  });
}

function runDoctor() {
  const lanIp = detectLanIp();

  console.log('Linqsy doctor');
  console.log(`Node.js: ${process.version}`);
  console.log(`LAN IP: ${lanIp ?? 'Unavailable'}`);
  console.log('Server stack: Node.js + Fastify + ws');
  console.log('Status: waiting room bootstrap ready');
}

function runVersion() {
  console.log(`${appMeta.name} ${appMeta.version}`);
}

function normalizeCliInput(argv: string[]) {
  const tokens = argv.filter((token) => token !== '--');
  const firstToken = tokens[0];

  if (firstToken && SUPPORTED_COMMANDS.has(firstToken)) {
    return {
      command: firstToken,
      args: tokens.slice(1),
    };
  }

  return {
    command: 'start',
    args: tokens,
  };
}

export async function main(argv = process.argv.slice(2)) {

  const { command, args } = normalizeCliInput(argv);

  if (command === 'version') {
    runVersion();
    return;
  }

  if (command === 'doctor') {
    runDoctor();
    return;
  }

  if (command === 'start') {
    await runStart(args);
    return;
  }

  console.error(`Unknown command: ${command}`);
  process.exit(1);
}

function isCliEntrypoint() {
  const argvPath = process.argv[1];

  if (!argvPath) {
    return false;
  }

  try {
    return realpathSync(argvPath) === fileURLToPath(import.meta.url);
  } catch {
    return import.meta.url === pathToFileURL(argvPath).href;
  }
}

if (isCliEntrypoint()) {
  void main();
}
