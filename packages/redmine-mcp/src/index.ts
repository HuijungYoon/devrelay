#!/usr/bin/env node
import { parseCliArgs } from "./cli.js";
import { startServer } from "./server.js";
import { startHttpServer } from "./httpServer.js";

const args = parseCliArgs(process.argv);
if (args.mode === "http") {
  startHttpServer({ port: args.port }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  startServer().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
