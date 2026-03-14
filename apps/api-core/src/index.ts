/**
 * VULTRA — API Core — Entry point
 *
 * Inicia o servidor ElysiaJS via Bun.
 * Porta configurável via env var PORT (default: 3000).
 */

import { app } from './app';

const port = Number(process.env['PORT'] ?? 3000);

app.listen(port, () => {
  console.log(`[VULTRA] API Core rodando em http://localhost:${port}`);
  console.log(`[VULTRA] Auth disponível em http://localhost:${port}/api/auth/ok`);
});
