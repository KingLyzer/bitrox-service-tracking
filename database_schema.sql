-- ====================================================================
-- ServiceTracker - Temiz Veritabanı Şeması & Başlangıç Verisi
-- Açık Kaynak / White-Label Dağıtımı İçin Hazırlanmıştır
-- Varsayılan Giriş: admin / admin123
-- ====================================================================

CREATE DATABASE IF NOT EXISTS `servicetracker_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `servicetracker_db`;

SET FOREIGN_KEY_CHECKS = 0;

-- --------------------------------------------------------------------
-- 1. ROLLER (roles)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL UNIQUE,
  `description` VARCHAR(255) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `roles` (`id`, `name`, `description`) VALUES
(1, 'Super Admin', 'Tüm sistem ve güvenlik ayarlarına tam yetkili yönetici'),
(2, 'Admin', 'Sistem yöneticisi'),
(3, 'Teknisyen', 'Servis, bakım ve envanter işlemlerini yürüten teknik personel'),
(4, 'Kullanıcı', 'Temel görüntüleme yetkisine sahip standart personel');

-- --------------------------------------------------------------------
-- 2. MODÜL YETKİLERİ (permissions)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `permissions`;
CREATE TABLE `permissions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `role_id` INT NOT NULL,
  `module` VARCHAR(100) NOT NULL,
  `can_view` TINYINT(1) NOT NULL DEFAULT 1,
  `can_create` TINYINT(1) NOT NULL DEFAULT 0,
  `can_edit` TINYINT(1) NOT NULL DEFAULT 0,
  `can_delete` TINYINT(1) NOT NULL DEFAULT 0,
  `can_admin` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_role_module` (`role_id`, `module`),
  FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Super Admin & Admin varsayılan tam yetkileri
INSERT INTO `permissions` (`role_id`, `module`, `can_view`, `can_create`, `can_edit`, `can_delete`, `can_admin`) VALUES
(1, 'dashboard', 1, 1, 1, 1, 1),
(1, 'service', 1, 1, 1, 1, 1),
(1, 'cargo', 1, 1, 1, 1, 1),
(1, 'bitlocker', 1, 1, 1, 1, 1),
(1, 'toner', 1, 1, 1, 1, 1),
(1, 'stock', 1, 1, 1, 1, 1),
(1, 'maintenance', 1, 1, 1, 1, 1),
(1, 'inventory', 1, 1, 1, 1, 1),
(1, 'users', 1, 1, 1, 1, 1),
(1, 'docs_forms', 1, 1, 1, 1, 1),
(1, 'address_label', 1, 1, 1, 1, 1),
(1, 'handover', 1, 1, 1, 1, 1),
(1, 'files', 1, 1, 1, 1, 1),
(1, 'tasks', 1, 1, 1, 1, 1),
(1, 'reports', 1, 1, 1, 1, 1),
(1, 'settings', 1, 1, 1, 1, 1),
(2, 'dashboard', 1, 1, 1, 1, 0),
(2, 'service', 1, 1, 1, 1, 0),
(2, 'cargo', 1, 1, 1, 1, 0),
(2, 'bitlocker', 1, 1, 1, 1, 0),
(2, 'toner', 1, 1, 1, 1, 0),
(2, 'stock', 1, 1, 1, 1, 0),
(2, 'maintenance', 1, 1, 1, 1, 0),
(2, 'inventory', 1, 1, 1, 1, 0),
(2, 'users', 1, 1, 1, 1, 0),
(2, 'docs_forms', 1, 1, 1, 1, 0),
(2, 'address_label', 1, 1, 1, 1, 0),
(2, 'handover', 1, 1, 1, 1, 0),
(2, 'files', 1, 1, 1, 1, 0),
(2, 'tasks', 1, 1, 1, 1, 0),
(2, 'reports', 1, 1, 1, 1, 0),
(2, 'settings', 1, 1, 1, 0, 0);

-- --------------------------------------------------------------------
-- 3. KULLANICILAR (users)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(100) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(150) NOT NULL,
  `role_id` INT NOT NULL DEFAULT 1,
  `email` VARCHAR(150) NULL,
  `phone` VARCHAR(50) NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `is_superadmin` TINYINT(1) NOT NULL DEFAULT 0,
  `manager_id` INT NULL,
  `allowed_locations` TEXT NULL,
  `last_login` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Varsayılan Admin Kullanıcısı: admin / admin123
INSERT INTO `users` (`id`, `username`, `password_hash`, `full_name`, `role_id`, `email`, `phone`, `is_active`, `is_superadmin`) VALUES
(1, 'admin', '$2b$10$eE.rL2rN/hS5nCgG7pB8Z.58LgW6Fj/T1l3cR7qgE9y8qE1vQ5e4q', 'Sistem Yöneticisi', 1, 'admin@example.com', '5550000000', 1, 1);

-- --------------------------------------------------------------------
-- 4. SERVİS FİŞLERİ (service_tickets & operations)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `service_tickets`;
CREATE TABLE `service_tickets` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `ticket_no` VARCHAR(50) NOT NULL UNIQUE,
  `customer_name` VARCHAR(150) NULL,
  `company_name` VARCHAR(150) NULL,
  `device_name` VARCHAR(150) NULL,
  `device_serial` VARCHAR(100) NULL,
  `fault_description` TEXT NULL,
  `solution_description` TEXT NULL,
  `priority` VARCHAR(30) DEFAULT 'Normal',
  `status` VARCHAR(50) DEFAULT 'Açık',
  `assigned_to` INT NULL,
  `technician_name` VARCHAR(150) NULL,
  `total_cost` DECIMAL(12,2) DEFAULT 0.00,
  `target_date` DATE NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_ticket_status` (`status`),
  INDEX `idx_ticket_date` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `service_operations`;
CREATE TABLE `service_operations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `ticket_id` INT NOT NULL,
  `operation_type` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `cost` DECIMAL(10,2) DEFAULT 0.00,
  `technician` VARCHAR(150) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`ticket_id`) REFERENCES `service_tickets`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `used_parts`;
CREATE TABLE `used_parts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `ticket_id` INT NOT NULL,
  `part_name` VARCHAR(150) NOT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `unit_price` DECIMAL(10,2) DEFAULT 0.00,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`ticket_id`) REFERENCES `service_tickets`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 5. KARGO TAKİP (cargo_shipments)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `cargo_shipments`;
CREATE TABLE `cargo_shipments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `direction` ENUM('incoming', 'outgoing') NOT NULL DEFAULT 'incoming',
  `status` VARCHAR(50) NOT NULL DEFAULT 'Teslim Alındı',
  `tracking_number` VARCHAR(100) NULL,
  `waybill_no` VARCHAR(100) NULL,
  `carrier` VARCHAR(100) NOT NULL,
  `sender` VARCHAR(150) NULL,
  `recipient_name` VARCHAR(150) NOT NULL,
  `receiver_phone` VARCHAR(50) NULL,
  `receiver_address` TEXT NULL,
  `department` VARCHAR(100) NULL,
  `package_type` VARCHAR(100) DEFAULT 'Koli / Paket',
  `package_count` INT DEFAULT 1,
  `received_date` DATETIME NULL,
  `received_by` VARCHAR(150) NULL,
  `asset_tag` VARCHAR(100) NULL,
  `asset_name` VARCHAR(150) NULL,
  `serial_no` VARCHAR(100) NULL,
  `model_name` VARCHAR(150) NULL,
  `service_ticket_no` VARCHAR(50) NULL,
  `service_ticket_id` INT NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_cargo_date` (`received_date`),
  INDEX `idx_cargo_tracking` (`tracking_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 6. TONER TAKİBİ (toner_items & toner_changes)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `toner_items`;
CREATE TABLE `toner_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `toner_model` VARCHAR(100) NOT NULL,
  `color` VARCHAR(50) DEFAULT 'Black - Siyah',
  `stock_qty` INT DEFAULT 0,
  `critical_threshold` INT DEFAULT 2,
  `snipe_id` INT NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `toner_changes`;
CREATE TABLE `toner_changes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `asset_id` INT NULL,
  `asset_name` VARCHAR(150) NULL,
  `toner_id` INT NOT NULL,
  `change_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `qty` INT NOT NULL DEFAULT 1,
  `assigned_user_id` INT NULL,
  `assigned_user_name` VARCHAR(150) NULL,
  `page_count` INT NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_toner_change_date` (`change_date`),
  FOREIGN KEY (`toner_id`) REFERENCES `toner_items`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 7. PERİYODİK BAKIM (maintenance_plans & checks)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `maintenance_plans`;
CREATE TABLE `maintenance_plans` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(200) NOT NULL,
  `company_name` VARCHAR(150) NOT NULL,
  `period` VARCHAR(100) NOT NULL,
  `planned_date` DATE NOT NULL,
  `status` VARCHAR(50) DEFAULT 'Planlandı',
  `total_devices` INT DEFAULT 0,
  `completed_devices` INT DEFAULT 0,
  `notes` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_plan_date` (`planned_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `maintenance_item_checks`;
CREATE TABLE `maintenance_item_checks` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `plan_id` INT NOT NULL,
  `asset_id` INT NULL,
  `asset_tag` VARCHAR(100) NOT NULL,
  `asset_name` VARCHAR(150) NULL,
  `model_name` VARCHAR(150) NULL,
  `serial_no` VARCHAR(100) NULL,
  `assigned_user` VARCHAR(150) NULL,
  `location_name` VARCHAR(150) NULL,
  `check_dust` TINYINT(1) DEFAULT 0,
  `check_fan` TINYINT(1) DEFAULT 0,
  `check_visual_audio` TINYINT(1) DEFAULT 0,
  `check_performance` TINYINT(1) DEFAULT 0,
  `check_ports` TINYINT(1) DEFAULT 0,
  `check_antivirus` TINYINT(1) DEFAULT 0,
  `check_license` TINYINT(1) DEFAULT 0,
  `check_network` TINYINT(1) DEFAULT 0,
  `check_standard_software` TINYINT(1) DEFAULT 0,
  `status` VARCHAR(50) DEFAULT 'Bekliyor',
  `tech_name` VARCHAR(150) NULL,
  `completed_at` DATETIME NULL,
  `notes` TEXT NULL,
  INDEX `idx_mic_completed` (`completed_at`),
  FOREIGN KEY (`plan_id`) REFERENCES `maintenance_plans`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 8. KİŞİSEL TAKVİM NOTLARI (user_calendar_notes)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `user_calendar_notes`;
CREATE TABLE `user_calendar_notes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL,
  `user_name` VARCHAR(150) NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `note_date` DATE NOT NULL,
  `color` VARCHAR(50) DEFAULT 'blue',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_note_date` (`note_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 9. BİTLOCKER ANAHTARLARI (bitlocker_keys & files)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `bitlocker_keys`;
CREATE TABLE `bitlocker_keys` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `computer_name` VARCHAR(150) NOT NULL,
  `user_name` VARCHAR(150) NULL,
  `drive_letter` VARCHAR(10) DEFAULT 'C:',
  `recovery_key` VARCHAR(100) NOT NULL,
  `key_id` VARCHAR(100) NULL,
  `encryption_method` VARCHAR(100) DEFAULT 'XTS-AES 128',
  `backup_date` DATE NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `bitlocker_files`;
CREATE TABLE `bitlocker_files` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `key_id` INT NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `file_path` VARCHAR(500) NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`key_id`) REFERENCES `bitlocker_keys`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 10. GÖREVLER & İŞ LİSTELERİ (tasks)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `tasks`;
CREATE TABLE `tasks` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `assigned_to` VARCHAR(150) NULL,
  `priority` VARCHAR(30) DEFAULT 'Normal',
  `status` VARCHAR(50) DEFAULT 'Bekliyor',
  `due_date` DATE NULL,
  `created_by` VARCHAR(150) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 11. SİSTEM AYARLARI (settings)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `settings`;
CREATE TABLE `settings` (
  `key` VARCHAR(100) PRIMARY KEY,
  `value` TEXT NULL,
  `category` VARCHAR(50) NOT NULL DEFAULT 'general',
  `label` VARCHAR(150) NULL,
  `description` VARCHAR(255) NULL,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `settings` (`key`, `value`, `category`, `label`) VALUES
('brand_title', 'Örnek Teknoloji A.Ş.', 'general', 'Kurum / Firma Başlığı'),
('company_name', 'Örnek Teknoloji A.Ş.', 'general', 'Şirket Adı'),
('db_type', 'mysql', 'server', 'Veritabanı Türü'),
('db_host', 'localhost', 'server', 'MySQL Host'),
('db_port', '3306', 'server', 'MySQL Port'),
('db_name', 'servicetracker_db', 'server', 'Veritabanı Adı'),
('db_user', 'root', 'server', 'MySQL Kullanıcı Adı'),
('db_pass', '', 'server', 'MySQL Şifresi');

-- --------------------------------------------------------------------
-- 12. DENETİM GÜNLÜĞÜ (audit_logs)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(100) NULL,
  `action` VARCHAR(50) NOT NULL,
  `module` VARCHAR(100) NOT NULL,
  `ref_id` INT NULL,
  `description` TEXT NULL,
  `old_value` LONGTEXT NULL,
  `new_value` LONGTEXT NULL,
  `ip_address` VARCHAR(50) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 13. DUYURULAR (announcements & reads)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `announcements`;
CREATE TABLE `announcements` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `content` TEXT NOT NULL,
  `priority` ENUM('normal', 'important', 'urgent') NOT NULL DEFAULT 'normal',
  `target_roles` VARCHAR(255) DEFAULT 'all',
  `target_locations` VARCHAR(255) DEFAULT 'all',
  `created_by` VARCHAR(100) NOT NULL,
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `announcement_reads`;
CREATE TABLE `announcement_reads` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `announcement_id` INT NOT NULL,
  `username` VARCHAR(100) NOT NULL,
  `read_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_announcement_user` (`announcement_id`, `username`),
  FOREIGN KEY (`announcement_id`) REFERENCES `announcements`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 14. DOSYA PAYLAŞIMI (public_file_shares)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `public_file_shares`;
CREATE TABLE `public_file_shares` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `token` VARCHAR(64) UNIQUE NOT NULL,
  `source_mode` ENUM('db', 'storage') NOT NULL DEFAULT 'db',
  `file_id` INT NULL,
  `storage_path` VARCHAR(500) NULL,
  `name` VARCHAR(255) NOT NULL,
  `type` ENUM('file', 'folder', 'note') NOT NULL DEFAULT 'file',
  `size` BIGINT DEFAULT 0,
  `created_by` INT NOT NULL,
  `password_hash` VARCHAR(255) NULL,
  `expires_at` DATETIME NULL,
  `download_limit` INT NULL,
  `download_count` INT DEFAULT 0,
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 15. WEB PUSH BİLDİRİMLERİ (webpush_subscriptions)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `webpush_subscriptions`;
CREATE TABLE `webpush_subscriptions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `endpoint` VARCHAR(500) NOT NULL UNIQUE,
  `p256dh` VARCHAR(255) NOT NULL,
  `auth` VARCHAR(100) NOT NULL,
  `user_id` INT NULL,
  `username` VARCHAR(100) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
