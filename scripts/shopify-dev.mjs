/* eslint-env node */

import { spawn } from "node:child_process";

const requiredOption = "--dns-result-order=ipv4first";
const existingNodeOptions = process.env.NODE_OPTIONS || "";
const nodeOptions = existingNodeOptions.includes(requiredOption)
  ? existingNodeOptions
  : `${requiredOption} ${existingNodeOptions}`.trim();

const shopifyCommand = process.platform === "win32" ? "shopify" : "shopify";
const child = spawn(shopifyCommand, ["app", "dev", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    NODE_OPTIONS: nodeOptions,
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
