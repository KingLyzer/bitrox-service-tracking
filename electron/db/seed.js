const bcrypt = require('bcryptjs');

function seed(db) {
  // -------------------------------------------------------
  // ROLLER
  // -------------------------------------------------------
  const insertRole = db.prepare(`
    INSERT OR IGNORE INTO roles (name, description) VALUES (?, ?)
  `);
  insertRole.run('Yönetici', 'Tüm modüllere tam erişim');
  insertRole.run('Teknik Personel', 'Servis ve stok işlemleri');
  insertRole.run('Görüntüleyici', 'Sadece görüntüleme yetkisi');

  // -------------------------------------------------------
  // KULLANICILAR
  // -------------------------------------------------------
  const adminHash = bcrypt.hashSync('admin123', 10);
  const techHash = bcrypt.hashSync('teknik123', 10);
  const viewHash = bcrypt.hashSync('goruntule123', 10);

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (username, password_hash, full_name, role_id, email, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
  `);
  insertUser.run('admin', adminHash, 'Sistem Yöneticisi', 1, 'admin@sirket.com');
  // Sadece 1 varsayılan admin kullanıcı bırakılmıştır

  // -------------------------------------------------------
  // İZİNLER (YETKİLER)
  // -------------------------------------------------------
  const modules = ['service', 'toner', 'stock', 'reports', 'settings', 'users', 'backup'];
  const insertPerm = db.prepare(`
    INSERT OR IGNORE INTO permissions (role_id, module, can_view, can_create, can_edit, can_delete, can_export, can_admin)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  for (const mod of modules) {
    insertPerm.run(1, mod, 1, 1, 1, 1, 1, 1);
  }
  
  for (const mod of modules) {
    if (mod === 'settings' || mod === 'users' || mod === 'backup') {
      insertPerm.run(2, mod, 1, 0, 0, 0, 0, 0);
    } else {
      insertPerm.run(2, mod, 1, 1, 1, 0, 1, 0);
    }
  }

  for (const mod of modules) {
    insertPerm.run(3, mod, 1, 0, 0, 0, 1, 0);
  }

  // -------------------------------------------------------
  // STOK KATEGORİLERİ
  // -------------------------------------------------------
  const insertCat = db.prepare(`INSERT OR IGNORE INTO stock_categories (name) VALUES (?)`);
  ['RAM / Bellek', 'SSD / Harddisk', 'Anakart', 'Güç Kaynağı', 'Kablo / Dönüştürücü', 'Klavye / Mouse', 'Toner / Kartuş', 'Ağ Ürünleri', 'Diğer'].forEach(c => insertCat.run(c));

  // -------------------------------------------------------
  // AYARLAR (SETTINGS)
  // -------------------------------------------------------
  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO settings (key, value, category, label) VALUES (?, ?, ?, ?)
  `);
  
  // Snipe-IT Ayarları
  insertSetting.run('snipeit_url', 'http://snipeit.local', 'snipeit', 'Snipe-IT URL');
  insertSetting.run('snipeit_api_key', '', 'snipeit', 'Snipe-IT API Anahtarı');
  
  // Firma bilgileri
  insertSetting.run('company_name', 'Örnek Teknoloji A.Ş.', 'company', 'Firma Adı');
  insertSetting.run('currency', 'TL', 'general', 'Para Birimi');
  insertSetting.run('theme', 'light', 'ui', 'Tema');
  insertSetting.run('ticket_prefix', 'SRV', 'tickets', 'Servis Fiş Öneki');
  insertSetting.run('stock_prefix', 'STK', 'stock', 'Stok Kodu Öneki');
  insertSetting.run('toner_prefix', 'TNR', 'toner', 'Toner Kodu Öneki');

  // -------------------------------------------------------
  // İŞLEM TÜRLERİ
  // -------------------------------------------------------
  const insertOpType = db.prepare(`INSERT OR IGNORE INTO operation_types (name, sort_order) VALUES (?, ?)`);
  ['Arıza Tespiti', 'Onarım / Müdahale', 'Parça Değişimi', 'Yazılım / Format', 'Toner Değişimi', 'Temizlik / Bakım', 'Test', 'İptal Edildi', 'Genel'].forEach((t, i) => {
    insertOpType.run(t, i + 1);
  });

  console.log('[Seed] Snipe-IT tabanlı yeni şema için örnek veriler yüklendi.');
}

module.exports = { seed };
