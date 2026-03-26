#!/bin/bash
set -e

VERSION="$1"
if [ -z "$VERSION" ]; then
  echo "Usage: npm run bump <version>"
  echo "Example: npm run bump 1.2.0"
  exit 1
fi

if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "Error: Version must be in semver format (e.g. 1.2.0)"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# package.json
sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" "$ROOT/package.json"

# src-tauri/Cargo.toml
sed -i "s/^version = \"[^\"]*\"/version = \"$VERSION\"/" "$ROOT/src-tauri/Cargo.toml"

# src-tauri/tauri.conf.json
sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" "$ROOT/src-tauri/tauri.conf.json"

echo "Bumped to v$VERSION in:"
echo "  - package.json"
echo "  - src-tauri/Cargo.toml"
echo "  - src-tauri/tauri.conf.json"
