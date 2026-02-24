import { spawn } from "node:child_process";

const port = process.env.PORT ?? "3000";
const host = process.env.HOSTNAME ?? "0.0.0.0";

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["next", "start", "-p", port, "-H", host],
  {
    stdio: "inherit",
    env: process.env,
  }
);

child.on("close", (code) => {
  process.exit(code ?? 1);
});
