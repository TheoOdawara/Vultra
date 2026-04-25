/**
 * VULTRA API Core — Entry Point
 *
 * Starts the ElysiaJS server via Bun.serve.
 * All composition happens in infrastructure/server.ts.
 */

import { app } from "./infrastructure/server";

const port = Number(process.env.PORT ?? 3000);

app.listen(port);

export type App = typeof app;
