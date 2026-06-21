import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const expectedWorkerName = "medugu-lims";
const requiredEnvExampleKeys = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_MEDUGU_PUBLIC_BASE_URL",
  "VITE_ZONE_READER_PUBLIC_URL",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ZONE_READER_INBOUND_TOKEN",
];

const failures = [];

function readJson(relativePath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
  } catch (error) {
    failures.push(`${relativePath}: ${error.message}`);
    return null;
  }
}

function readText(relativePath) {
  try {
    return fs.readFileSync(path.join(root, relativePath), "utf8");
  } catch (error) {
    failures.push(`${relativePath}: ${error.message}`);
    return "";
  }
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function listFiles(dir, out = []) {
  if (!exists(dir)) return out;
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listFiles(relative, out);
    } else {
      out.push(relative);
    }
  }
  return out;
}

function hasFiles(dir) {
  return listFiles(dir).length > 0;
}

const packageJson = readJson("package.json");
const packageLock = readText("package-lock.json");

if (packageJson) {
  const allDeps = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
  };
  assert(!Object.keys(allDeps).some((name) => name.startsWith("@lovable.dev/")), "package.json still depends on @lovable.dev/*");
  assert(!("lovable-tagger" in allDeps), "package.json still depends on lovable-tagger");
  assert(Boolean(packageJson.devDependencies?.wrangler), "package.json must keep wrangler as a dev dependency");
  assert(packageJson.scripts?.deploy === "wrangler deploy", "package.json must expose deploy: wrangler deploy");
}

assert(!packageLock.includes("@lovable.dev/"), "package-lock.json still references @lovable.dev packages");
assert(!packageLock.includes("lovable-tagger"), "package-lock.json still references lovable-tagger");

assert(!hasFiles(".lovable"), ".lovable metadata files must not exist");
assert(!hasFiles("src/integrations/lovable"), "src/integrations/lovable files must not exist");

const viteConfig = readText("vite.config.ts");
assert(viteConfig.includes("@cloudflare/vite-plugin"), "vite.config.ts must use @cloudflare/vite-plugin");
assert(viteConfig.includes("@tanstack/react-start/plugin/vite"), "vite.config.ts must use TanStack Start directly");
assert(!viteConfig.includes("@lovable.dev/"), "vite.config.ts must not use Lovable Vite config");

const wranglerConfig = readText("wrangler.jsonc");
assert(wranglerConfig.includes(`"name": "${expectedWorkerName}"`), `wrangler.jsonc worker name must be ${expectedWorkerName}`);
assert(wranglerConfig.includes("@tanstack/react-start/server-entry"), "wrangler.jsonc must target TanStack Start server entry");

const workflow = readText(".github/workflows/deploy.yml");
assert(workflow.includes("cloudflare/wrangler-action@v3"), "deploy workflow must use cloudflare/wrangler-action@v3");
assert(workflow.includes("CLOUDFLARE_DEPLOY_ENABLED"), "deploy workflow must require CLOUDFLARE_DEPLOY_ENABLED");
assert(workflow.includes("npm test"), "deploy workflow must run tests");
assert(workflow.includes("npm run build"), "deploy workflow must run production build");

const envExample = readText(".env.example");
for (const key of requiredEnvExampleKeys) {
  assert(envExample.includes(`${key}=`), `.env.example must document ${key}`);
}

const runtimeFiles = [
  "package.json",
  "package-lock.json",
  "vite.config.ts",
  "wrangler.jsonc",
  ".env.example",
  ...listFiles("src"),
  ...listFiles(".github"),
];
const forbiddenRuntimePatterns = [
  /@lovable\.dev\//i,
  /lovable-tagger/i,
  /createLovableAuth/i,
  /ai\.gateway\.lovable\.dev/i,
  /\.lovable\.app/i,
  /lovableproject\.com/i,
  /LOVABLE_/,
];

for (const file of runtimeFiles) {
  const text = readText(file);
  for (const pattern of forbiddenRuntimePatterns) {
    assert(!pattern.test(text), `${file} contains forbidden Lovable runtime reference: ${pattern}`);
  }
}

if (failures.length) {
  console.error("Outside-Lovable preflight failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Outside-Lovable preflight passed for Medugu LIMS.");
