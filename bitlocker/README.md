# BitLocker Key Vault

PHP + SQLite ile BitLocker kurtarma anahtari yonetimi.

## Kurulum (Debian)

```bash
chmod +x setup.sh run.sh
./setup.sh
```

PHP yoksa:

```bash
sudo apt-get update && sudo apt-get install -y php php-sqlite3
```

Kurulum, admin kullanicisi ve veritabani olusturur.

## Calistirma

```bash
./run.sh
```

Uygulama: http://localhost:8000

## Notlar

- Yukleme sirasinda ad soyad zorunlu.
- Dosya .txt veya .html olabilir; HTML otomatik olarak metne cevrilir.
- Anahtara tiklayinca panoya kopyalanir.
