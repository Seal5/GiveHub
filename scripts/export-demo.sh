#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
output_dir="${1:-"$repo_root/apps/mobile/dist"}"

EXPO_PUBLIC_DEMO_MODE=true \
EXPO_PUBLIC_LOCAL_AUTH=false \
EXPO_PUBLIC_API_URL= \
EXPO_PUBLIC_SHARE_BASE_URL= \
EXPO_PUBLIC_SUPABASE_URL= \
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY= \
EXPO_PUBLIC_WEB_BASE_URL="${EXPO_PUBLIC_WEB_BASE_URL:-/givehub-demo}" \
pnpm --dir "$repo_root" --filter @givehub/mobile exec expo export --platform web --output-dir "$output_dir"

# GitHub Pages serves 404.html for client-side routes. It must use the same
# hashed assets as index.html, including after a new export.
cp "$output_dir/index.html" "$output_dir/404.html"
touch "$output_dir/.nojekyll"
