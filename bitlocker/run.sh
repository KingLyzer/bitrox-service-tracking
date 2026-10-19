#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if ! command -v php >/dev/null 2>&1; then
  echo "PHP bulunamadi. Once ./setup.sh calistirin."
  exit 1
fi

PORT="${PORT:-18080}"
echo "Sunucu basladi: http://localhost:${PORT}"
php -d upload_max_filesize=50M -d post_max_size=200M -d max_file_uploads=500 -S "0.0.0.0:${PORT}" -t public
