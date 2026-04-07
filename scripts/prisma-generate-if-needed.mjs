/* eslint-env node */

import { readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const cwd = process.cwd();
const sourceSchemaPath = path.join(cwd, "prisma", "schema.prisma");
const generatedDir = path.join(cwd, "node_modules", ".prisma", "client");
const generatedSchemaPath = path.join(generatedDir, "schema.prisma");
const requiredGeneratedFiles = [
  "index.js",
  "index.d.ts",
  "client.js",
  "query_engine-windows.dll.node",
];

async function fileExists(targetPath) {
  try {
    await access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function hasUsableGeneratedClient() {
  const sourceSchemaExists = await fileExists(sourceSchemaPath);
  const generatedSchemaExists = await fileExists(generatedSchemaPath);

  if (!sourceSchemaExists || !generatedSchemaExists) {
    return false;
  }

  const requiredFiles = await Promise.all(
    requiredGeneratedFiles.map(async (fileName) => {
      return fileExists(path.join(generatedDir, fileName));
    }),
  );

  if (requiredFiles.some((exists) => !exists)) {
    return false;
  }

  const [sourceSchema, generatedSchema] = await Promise.all([
    readFile(sourceSchemaPath, "utf8"),
    readFile(generatedSchemaPath, "utf8"),
  ]);

  const normalizedSourceSchema = sourceSchema.replace(/\s+/g, " ").trim();
  const normalizedGeneratedSchema = generatedSchema.replace(/\s+/g, " ").trim();

  if (normalizedSourceSchema !== normalizedGeneratedSchema) {
    return false;
  }

  return true;
}

function runPrismaGenerate() {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["prisma", "generate"], {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: process.env,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`prisma generate exited with code ${code ?? "unknown"}`));
    });

    child.on("error", reject);
  });
}

const isReady = await hasUsableGeneratedClient();

if (isReady) {
  console.log("Prisma client already matches current schema, skipping generate.");
  process.exit(0);
}

console.log("Prisma client is out of date, running prisma generate...");

try {
  await runPrismaGenerate();
} catch (error) {
  const fallbackReady = await hasUsableGeneratedClient();

  if (fallbackReady) {
    console.warn(
      "Prisma generate failed because the Windows query engine file is locked, but the existing client is still usable. Continuing with the current generated client.",
    );
    process.exit(0);
  }

  throw error;
}
