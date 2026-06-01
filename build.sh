#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

echo "▶ Building..."
npm run build
echo "✔ Done → main.js"
echo ""
echo "Copy the following files to your Vault's plugin directory:"
echo "  {vault}/.obsidian/plugins/triangle-graph-view/"
echo ""
echo "  main.js"
echo "  manifest.json"
echo "  styles.css"
