import type { Server as HttpServer } from "node:http";
import { createHttpApp } from "./http/app.js";
import { logInfo } from "./logging.js";

export async function startHttpServer(opts?: {
  port?: number;
  allowEnvFallback?: boolean;
}): Promise<HttpServer> {
  const port = opts?.port ?? Number(process.env.PORT ?? 8080);
  const app = createHttpApp({
    allowEnvFallback:
      opts?.allowEnvFallback ?? process.env.HTTP_ALLOW_ENV_FALLBACK === "1",
  });

  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      logInfo("redmine-mcp http listening", { port });
      resolve(server);
    });
    server.on("error", reject);
  });
}
