import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = process.cwd();
const vinextEntry = fileURLToPath(import.meta.resolve("vinext"));
const vinextDist = path.dirname(vinextEntry);

const [{ loadDotenv }, { parseArgs }, { startProdServer }] = await Promise.all([
  import(pathToFileURL(path.join(vinextDist, "config", "dotenv.js")).href),
  import(pathToFileURL(path.join(vinextDist, "cli-args.js")).href),
  import(pathToFileURL(path.join(vinextDist, "server", "prod-server.js")).href),
]);

const parsed = parseArgs(process.argv.slice(2));
if (parsed.help) {
  console.log("Usage: npm run start -- [--port <port>] [--hostname <host>]");
  process.exit(0);
}

loadDotenv({ root: projectRoot, mode: "production" });
const port = parsed.port ?? Number.parseInt(process.env.PORT ?? "3000", 10);
const host = parsed.hostname ?? "0.0.0.0";

console.log(`\n  vinext start  (port ${port})\n`);

const originalRelative = path.relative;
if (process.platform === "win32") {
  // vinext 0.0.50 caches Windows paths with backslashes, then looks them up
  // using URL slashes. Normalize only while its startup cache is constructed.
  path.relative = (from, to) => originalRelative(from, to).replaceAll(path.sep, "/");
}

try {
  await startProdServer({ port, host, outDir: path.join(projectRoot, "dist") });
} finally {
  path.relative = originalRelative;
}
