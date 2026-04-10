/**
 * env-server — WebSocket host for multi-instance GameEnvironment execution.
 *
 * Primary target is Bomberman26 for remote training/evaluation. N64Wasm is
 * intentionally rejected in this Node host because the emulator currently
 * depends on a browser/WebGL runtime rather than pure Node execution.
 */

import { createServer } from 'node:http';
import { WebSocketServer, type RawData, type WebSocket } from 'ws';

import { Bomberman26Environment } from '@bomberman65/env-bomberman26';
import { EnvironmentServer } from '@bomberman65/platform-server';
import type { GameEnvironment, RemoteEnvironmentRequest } from '@bomberman65/platform-core';

const DEFAULT_PORT = 4315;

function createEnvironment(envType: string): GameEnvironment {
  switch (envType) {
    case 'bomberman26':
      return new Bomberman26Environment();
    case 'n64wasm':
      throw new Error(
        'n64wasm is not available in the Node env-server. Use the benchmark harness or a browser-backed host instead.',
      );
    default:
      throw new Error(`Unsupported environment type '${envType}'.`);
  }
}

async function main(): Promise<void> {
  const port = Number.parseInt(process.env['BOMBERMAN65_ENV_SERVER_PORT'] ?? '', 10) || DEFAULT_PORT;
  const server = createServer();
  const wss = new WebSocketServer({ server });
  const envServer = new EnvironmentServer({ createEnvironment });

  wss.on('connection', (socket: WebSocket) => {
    socket.on('message', async (data: RawData, isBinary: boolean) => {
      if (isBinary) {
        socket.send(
          JSON.stringify({
            kind: 'error',
            requestId: 'binary',
            message: 'Binary messages are not supported. Send JSON RemoteEnvironmentRequest payloads.',
          }),
        );
        return;
      }

      let request: RemoteEnvironmentRequest;
      try {
        request = JSON.parse(data.toString()) as RemoteEnvironmentRequest;
      } catch (error) {
        socket.send(
          JSON.stringify({
            kind: 'error',
            requestId: 'parse',
            message: error instanceof Error ? error.message : String(error),
          }),
        );
        return;
      }

      const response = await envServer.handleRequest(request);
      socket.send(JSON.stringify(response));
    });
  });

  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Bomberman 65 environment server listening on ws://localhost:${port}`);
  });

  const shutdown = async () => {
    await envServer.dispose();
    wss.close();
    server.close();
  };

  process.on('SIGINT', () => {
    void shutdown().finally(() => process.exit(0));
  });
  process.on('SIGTERM', () => {
    void shutdown().finally(() => process.exit(0));
  });
}

void main();
