import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const antibioticsPath = path.join(root, 'src/medugu/config/antibiotics.ts');
const breakpointsPath = path.join(
  root,
  'src/medugu/config/breakpointRegistry/eucast2026/enterobacterales.ts',
);

const antibioticsSrc = fs.readFileSync(antibioticsPath, 'utf8');
const breakpointsSrc = fs.readFileSync(breakpointsPath, 'utf8');

const mappingBlockMatch = antibioticsSrc.match(/const REQUESTED_NAME_TO_CODE:[\s\S]*?=\s*\{([\s\S]*?)\};/);
if (!mappingBlockMatch) {
  console.error('Could not parse REQUESTED_NAME_TO_CODE map.');
  process.exit(1);
}

const nameToCode = new Map();
for (const line of mappingBlockMatch[1].split('\n')) {
  const m = line.match(/\s*(?:"([^"]+)"|([a-z_][\w-]*))\s*:\s*"([A-Z0-9_-]+)"/i);
  if (m) {
    const key = m[1] || m[2];
    nameToCode.set(key, m[3]);
  }
}

const panelMatch = antibioticsSrc.match(
  /makePanel\(\s*"enterobacterales"[\s\S]*?\[([\s\S]*?)\]\s*,\s*\["enterobacterales"\]/,
);
if (!panelMatch) {
  console.error('Could not parse Enterobacterales panel requested list.');
  process.exit(1);
}

const requested = Array.from(panelMatch[1].matchAll(/"([^"]+)"/g)).map((m) => m[1]);
const mappedCodes = requested.map((name) => ({
  name,
  code: nameToCode.get(name),
}));

const records = Array.from(
  breakpointsSrc.matchAll(/antibioticCode:\s*"([A-Z0-9_-]+)"[\s\S]*?breakpointStatus:\s*"([a-z_]+)"/g),
).map((m) => ({ code: m[1], status: m[2] }));

const coverage = new Map();
for (const r of records) {
  if (!coverage.has(r.code)) coverage.set(r.code, new Set());
  coverage.get(r.code).add(r.status);
}

const issues = [];
for (const item of mappedCodes) {
  if (!item.code) {
    issues.push(`No code mapping for requested antibiotic: ${item.name}`);
    continue;
  }
  if (!coverage.has(item.code)) {
    issues.push(`No breakpoint rows found for mapped code ${item.code} (${item.name})`);
  }
}

console.log('Enterobacterales panel requested antibiotics:', requested.length);
console.log('Mapped codes:', mappedCodes.filter((i) => i.code).length);
console.log('Breakpoint codes in registry:', coverage.size);

for (const { name, code } of mappedCodes) {
  if (!code) continue;
  const statuses = coverage.get(code);
  console.log(`- ${name} -> ${code}: ${statuses ? [...statuses].join(', ') : 'NO_ROWS'}`);
}

if (issues.length > 0) {
  console.error('\nCoverage issues found:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log('\nCoverage check passed.');
