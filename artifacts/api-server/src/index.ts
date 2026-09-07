import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

// A tutor reply can legitimately take up to 45 seconds (lib/anthropic.ts's
// request timeout). Without this, a deploy's SIGTERM kills the process
// immediately and drops whatever request was mid-flight. http.Server#close
// stops accepting new connections but lets in-flight ones finish on their
// own, so we just wait for that instead of exiting right away.
function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down gracefully");
  server.close((err) => {
    if (err) {
      logger.error({ err }, "Error during shutdown");
      process.exit(1);
    }
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
