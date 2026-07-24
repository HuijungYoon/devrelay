export function parseCliArgs(argv: string[]): {
  mode: "stdio" | "http";
  port?: number;
} {
  const args = argv.slice(2);
  const mode = args.includes("--http") ? "http" : "stdio";
  const portIdx = args.indexOf("--port");
  const port =
    portIdx >= 0 && args[portIdx + 1] !== undefined
      ? Number(args[portIdx + 1])
      : undefined;

  if (mode === "http") {
    return port !== undefined && !Number.isNaN(port)
      ? { mode, port }
      : { mode };
  }
  return { mode: "stdio" };
}
