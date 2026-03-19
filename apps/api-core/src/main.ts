/**
 * VULTRA — API Core — Entry point
 *
 * Inicia o servidor ElysiaJS via Bun.
 * Porta configurável via env var PORT (obrigatória).
 */

import type { Server } from "bun";
import { app } from "./infrastructure/server.ts";

if (!process.env.PORT) {
  throw new Error("[VULTRA] PORT env var não está definida. Verifique o .env");
}

const port = Number(process.env.PORT);

app.listen(port, (server: Server<undefined>) => {
  // biome-ignore lint/suspicious/noConsole: logs de startup intencionais
  console.log(`[VULTRA] API Core rodando em http://${server.hostname}:${server.port}`);
  // biome-ignore lint/suspicious/noConsole: logs de startup intencionais
  console.log(`[VULTRA] Auth disponível em http://${server.hostname}:${server.port}/api/auth/ok`);
});
