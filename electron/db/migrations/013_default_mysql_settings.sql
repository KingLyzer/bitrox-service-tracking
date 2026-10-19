-- Varsayılan MySQL bağlantı ayarları
-- Yeni kurulumlarda veritabanı bilgileri elle girilmeden hazır gelsin.

INSERT OR IGNORE INTO settings ("key", "value", category, label)
VALUES
  ('db_type', 'mysql', 'server', 'Veritabanı Altyapı Türü'),
  ('db_host', 'localhost', 'server', 'Sunucu IP / Host'),
  ('db_port', '3306', 'server', 'MySQL Port'),
  ('db_user', 'root', 'server', 'MySQL Kullanıcı Adı'),
  ('db_pass', '', 'server', 'MySQL Şifresi'),
  ('db_name', 'servicetracker_db', 'server', 'Veritabanı Adı');
