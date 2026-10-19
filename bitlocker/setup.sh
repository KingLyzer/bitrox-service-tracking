#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "BitLocker Key Vault kurulumu basliyor..."

if ! command -v php >/dev/null 2>&1; then
  echo "PHP bulunamadi. Debian icin: sudo apt-get update && sudo apt-get install -y php php-sqlite3"
  exit 1
fi

read -r -p "Admin kullanici adi (varsayilan: itadmin): " admin_user
if [[ -z "${admin_user}" ]]; then
  admin_user="itadmin"
fi

read -r -s -p "Admin sifresi: " admin_pass
echo ""
if [[ -z "${admin_pass}" ]]; then
  echo "Sifre bos olamaz."
  exit 1
fi

echo "Veritabani olusturuluyor..."
php scripts/init.php --admin-user="${admin_user}" --admin-pass="${admin_pass}"

echo "Kurulum tamamlandi."
echo "Uygulamayi calistirmak icin: ./run.sh"
