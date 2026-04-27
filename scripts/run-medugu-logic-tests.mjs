#!/usr/bin/env node

import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const testsDir = path.join(repoRoot, "src", "medugu", "logic", "__tests__");

function runWithTsx(filePath) {
  return new Promise((resolve) => {
    const child = spawn("npx", ["--no-install", "tsx", filePath], {
      cwd: repoRoot,
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.on("close", (code) => {
      resolve(code ?? 1);
    });

    child.on("error", () => {
      resolve(1);
    });
  });
}

async function main() {
  const entries = await readdir(testsDir, { withFileTypes: true });
  const testFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => path.join(testsDir, entry.name))
    .sort();

  if (testFiles.length === 0) {
    console.log("[logic-tests] No .ts tests found.");
    return;
  }

  console.log(
    `[logic-tests] Running ${testFiles.length} test files from ${path.relative(repoRoot, testsDir)}`,
  );

  let passed = 0;
  let failed = 0;

  for (const file of testFiles) {
    const relativeFile = path.relative(repoRoot, file);
    console.log(`\n[logic-tests] START ${relativeFile}`);

    const exitCode = await runWithTsx(file);
    if (exitCode === 0) {
      passed += 1;
      console.log(`[logic-tests] PASS  ${relativeFile}`);
      continue;
    }

    failed += 1;
    console.log(`[logic-tests] FAIL  ${relativeFile}`);
    break;
  }

  console.log(
    `\n[logic-tests] Summary: passed=${passed}, failed=${failed}, total=${testFiles.length}`,
  );

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[logic-tests] Runner crashed:", error);
  process.exitCode = 1;
});
