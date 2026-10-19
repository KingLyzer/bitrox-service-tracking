-- =========================================================
-- Servis ve Toner Takip Sistemi — Veritabanı Şeması
-- Migration 001 — İlk kurulum
-- =========================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- -------------------------------------------------------
-- ROLLER VE YETKİLER
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role_id INTEGER NOT NULL DEFAULT 1,
  email TEXT,
  phone TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_login DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_id INTEGER NOT NULL,
  module TEXT NOT NULL,
  can_view INTEGER NOT NULL DEFAULT 1,
  can_create INTEGER NOT NULL DEFAULT 0,
  can_edit INTEGER NOT NULL DEFAULT 0,
  can_delete INTEGER NOT NULL DEFAULT 0,
  can_export INTEGER NOT NULL DEFAULT 0,
  can_admin INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- -------------------------------------------------------
-- DEPARTMANLAR VE KİŞİLER
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  location TEXT,
  manager TEXT,
  phone TEXT,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  dept_id INTEGER,
  phone TEXT,
  ext_phone TEXT,
  email TEXT,
  location TEXT,
  person_type TEXT NOT NULL DEFAULT 'Personel', -- Personel / Departman / Tedarikçi / Dış Kişi
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dept_id) REFERENCES departments(id)
);

-- -------------------------------------------------------
-- CİHAZ TANIMLARI
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS device_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  icon TEXT DEFAULT 'desktop',
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS brands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  website TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_code TEXT NOT NULL UNIQUE,
  type_id INTEGER,
  brand_id INTEGER,
  model TEXT,
  serial_no TEXT,
  asset_no TEXT,
  dept_id INTEGER,
  person_id INTEGER,
  purchase_date DATE,
  warranty_end DATE,
  status TEXT NOT NULL DEFAULT 'Aktif', -- Aktif / Serviste / Arızalı / Depo / Hurdaya Ayrıldı
  description TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (type_id) REFERENCES device_types(id),
  FOREIGN KEY (brand_id) REFERENCES brands(id),
  FOREIGN KEY (dept_id) REFERENCES departments(id),
  FOREIGN KEY (person_id) REFERENCES people(id)
);

-- -------------------------------------------------------
-- SERVİS FİŞLERİ
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_no TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  person_id INTEGER,
  dept_id INTEGER,
  contact_phone TEXT,
  device_id INTEGER,
  device_type_id INTEGER,
  brand_id INTEGER,
  model TEXT,
  serial_no TEXT,
  asset_no TEXT,
  warranty_status TEXT DEFAULT 'Bilinmiyor', -- Garanti İçinde / Garanti Dışı / Bilinmiyor
  fault_desc TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'Normal', -- Düşük / Normal / Yüksek / Acil
  status TEXT NOT NULL DEFAULT 'Yeni Kayıt',
  -- Yeni Kayıt / İncelemede / Parça Bekliyor / Onarımda / Testte / Tamamlandı / Teslim Edildi / İptal
  accessories TEXT,
  notes TEXT,
  total_cost REAL DEFAULT 0,
  service_fee REAL DEFAULT 0,
  delivery_date DATE,
  delivered_by INTEGER, -- user_id
  delivered_to TEXT,
  assigned_user_id INTEGER,
  closed_at DATETIME,
  FOREIGN KEY (person_id) REFERENCES people(id),
  FOREIGN KEY (dept_id) REFERENCES departments(id),
  FOREIGN KEY (device_id) REFERENCES devices(id),
  FOREIGN KEY (device_type_id) REFERENCES device_types(id),
  FOREIGN KEY (brand_id) REFERENCES brands(id),
  FOREIGN KEY (assigned_user_id) REFERENCES users(id),
  FOREIGN KEY (delivered_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS service_operations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL,
  op_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  user_id INTEGER,
  op_type TEXT NOT NULL DEFAULT 'Genel',
  description TEXT NOT NULL,
  duration_min INTEGER DEFAULT 0,
  status_change TEXT,
  internal_note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES service_tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- -------------------------------------------------------
-- STOK / PARÇA YÖNETİMİ
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS stock_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stock_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category_id INTEGER,
  brand_compat TEXT,
  model_compat TEXT,
  qty REAL NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'Adet',
  critical_qty REAL DEFAULT 0,
  unit_price REAL DEFAULT 0,
  supplier_id INTEGER,
  location TEXT,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES stock_categories(id),
  FOREIGN KEY (supplier_id) REFERENCES people(id)
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stock_id INTEGER NOT NULL,
  move_type TEXT NOT NULL, -- Giriş / Çıkış / Servis / Düzeltme
  qty REAL NOT NULL,
  ref_type TEXT, -- ticket / manual
  ref_id INTEGER,
  user_id INTEGER,
  move_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  FOREIGN KEY (stock_id) REFERENCES stock_items(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS used_parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL,
  stock_id INTEGER,
  part_name TEXT NOT NULL,
  stock_code TEXT,
  qty REAL NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'Adet',
  unit_price REAL DEFAULT 0,
  total_price REAL DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES service_tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (stock_id) REFERENCES stock_items(id)
);

-- -------------------------------------------------------
-- TONER / KARTUŞ
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS printer_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_id INTEGER,
  model_name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (brand_id) REFERENCES brands(id)
);

CREATE TABLE IF NOT EXISTS printers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  printer_name TEXT NOT NULL,
  brand_id INTEGER,
  model TEXT,
  serial_no TEXT,
  asset_no TEXT,
  dept_id INTEGER,
  person_id INTEGER,
  ip_address TEXT,
  status TEXT DEFAULT 'Aktif',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (brand_id) REFERENCES brands(id),
  FOREIGN KEY (dept_id) REFERENCES departments(id),
  FOREIGN KEY (person_id) REFERENCES people(id)
);

CREATE TABLE IF NOT EXISTS toner_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  toner_code TEXT NOT NULL UNIQUE,
  toner_model TEXT NOT NULL,
  brand_id INTEGER,
  color TEXT DEFAULT 'Siyah', -- Siyah / Cyan / Magenta / Sarı / Renkli
  compatible_printers TEXT,
  qty INTEGER NOT NULL DEFAULT 0,
  critical_qty INTEGER DEFAULT 2,
  unit_price REAL DEFAULT 0,
  supplier_id INTEGER,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (brand_id) REFERENCES brands(id),
  FOREIGN KEY (supplier_id) REFERENCES people(id)
);

CREATE TABLE IF NOT EXISTS toner_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  printer_id INTEGER NOT NULL,
  toner_id INTEGER NOT NULL,
  change_date DATE NOT NULL DEFAULT (date('now')),
  person_id INTEGER,
  user_id INTEGER,
  page_count INTEGER,
  old_page_count INTEGER,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (printer_id) REFERENCES printers(id),
  FOREIGN KEY (toner_id) REFERENCES toner_items(id),
  FOREIGN KEY (person_id) REFERENCES people(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- -------------------------------------------------------
-- EKLER VE SİSTEM
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_type TEXT NOT NULL, -- ticket / device / toner
  ref_id INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by INTEGER,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  label TEXT,
  description TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS operation_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  username TEXT,
  action TEXT NOT NULL, -- CREATE / UPDATE / DELETE / LOGIN / LOGOUT / EXPORT
  module TEXT NOT NULL,
  ref_id INTEGER,
  description TEXT,
  old_value TEXT,
  new_value TEXT,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- -------------------------------------------------------
-- İNDEKSLER
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_service_tickets_status ON service_tickets(status);
CREATE INDEX IF NOT EXISTS idx_service_tickets_priority ON service_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_service_tickets_created_at ON service_tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_service_tickets_dept ON service_tickets(dept_id);
CREATE INDEX IF NOT EXISTS idx_service_operations_ticket ON service_operations(ticket_id);
CREATE INDEX IF NOT EXISTS idx_used_parts_ticket ON used_parts(ticket_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_stock ON stock_movements(stock_id);
CREATE INDEX IF NOT EXISTS idx_toner_changes_printer ON toner_changes(printer_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_devices_dept ON devices(dept_id);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
