#!/usr/bin/env bash

set -euo pipefail

echo "Creating google-services.json from environment variable..."

if [ -n "${GOOGLE_SERVICES_JSON:-}" ]; then
  echo "$GOOGLE_SERVICES_JSON" | base64 -d > google-services.json
  echo "✓ google-services.json created successfully"
else
  echo "⚠ GOOGLE_SERVICES_JSON environment variable not found"
  exit 1
fi
