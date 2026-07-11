import "dotenv/config";

import { runWorkerLoop } from "@/lib/queue/worker";

const loop = runWorkerLoop();

function shutdown(signal: string) {
  console.info(JSON.stringify({ msg: "Worker shutting down", signal }));
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

void loop;
