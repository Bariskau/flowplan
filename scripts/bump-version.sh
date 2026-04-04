#!/bin/bash
set -euo pipefail

VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  echo "Usage: npm run bump <version>"
  echo "Example: npm run bump 1.3.1"
  exit 1
fi

if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "Error: Version must be in semver format (e.g. 1.3.1)"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

node - "$ROOT" "$VERSION" <<'NODE'
const fs = require("fs");
const path = require("path");

const root = process.argv[2];
const version = process.argv[3];

function writeJson(relPath, mutate) {
  const filePath = path.join(root, relPath);
  const json = JSON.parse(fs.readFileSync(filePath, "utf8"));
  mutate(json);
  fs.writeFileSync(filePath, `${JSON.stringify(json, null, 2)}\n`);
}

function replaceInFile(relPath, replacers) {
  const filePath = path.join(root, relPath);
  let content = fs.readFileSync(filePath, "utf8");
  for (const [pattern, replacement] of replacers) {
    content = content.replace(pattern, replacement);
  }
  fs.writeFileSync(filePath, content);
}

writeJson("package.json", (json) => {
  json.version = version;
});

writeJson("package-lock.json", (json) => {
  json.version = version;
  if (json.packages && json.packages[""]) {
    json.packages[""].version = version;
  }
});

writeJson("src-tauri/tauri.conf.json", (json) => {
  json.version = version;
});

replaceInFile("src-tauri/Cargo.toml", [
  [/^version = "[^"]*"/m, `version = "${version}"`],
]);

replaceInFile("docs/index.html", [
  [/flowplan-v\d+\.\d+\.\d+/g, `flowplan-v${version}`],
  [/FlowPlan_\d+\.\d+\.\d+_amd64\.deb/g, `FlowPlan_${version}_amd64.deb`],
  [/FlowPlan_\d+\.\d+\.\d+_aarch64\.dmg/g, `FlowPlan_${version}_aarch64.dmg`],
  [/FlowPlan_\d+\.\d+\.\d+_x64\.dmg/g, `FlowPlan_${version}_x64.dmg`],
  [/let version = '\d+\.\d+\.\d+';/, `let version = '${version}';`],
]);

console.log(`Bumped FlowPlan to v${version}`);
NODE
