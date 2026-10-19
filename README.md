# 🛠️ ServiceTracker — Kurumsal Servis, Bakım ve IT Envanter Takip Portalı

![Version](https://img.shields.io/badge/version-2.3.2-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![React](https://img.shields.io/badge/React-18-61dafb.svg)
![Node](https://img.shields.io/badge/Node.js-18%2B-339933.svg)
![MySQL](https://img.shields.io/badge/MySQL-8.0%2B-4479A1.svg)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8%2B-black.svg)

**ServiceTracker**, modern kurumsal IT departmanları, teknik servis ekipleri ve envanter yöneticileri için geliştirilmiş; arıza kayıtlarından lojistiğe, periyodik bakımdan BitLocker güvenliğine kadar tüm operasyonları tek bir çatı altında toplayan açık kaynaklı ve beyaz etiketli (white-label) bir yönetim sistemidir.

---

## ✨ Öne Çıkan Özellikler ve Modüller

### 1. 🔧 Teknik Servis Fişleri
- Seri numarası veya barkod ile hızlı kabul ve arıza kaydı oluşturma.
- Snipe-IT envanteriyle anlık entegrasyon (cihaz ve zimmetli personeli otomatik eşleme).
- Aşama takibi (*Yeni Kayıt ➔ Onarımda ➔ Parça Bekliyor ➔ Dış Servis ➔ Tamamlandı / Teslim Edildi*).
- Kullanılan yedek parça, işçilik maliyeti ve ıslak imzalı servis fişi çıktısı alma.

### 2. 🗓️ Master Operasyon Takvimi
- Tüm kurumsal IT hareketlerinin (Servis Fişleri, Kargo Sevkiyatları, Toner Değişimleri, Periyodik Bakım ve Kişisel IT Notları) tek ekranda renk kodlarıyla izlenmesi.
- Açılır-kapanır (*Slide-in*) Günlük Operasyon Raporu paneli.
- Kişisel not ve hatırlatıcı ekleme (önem derecesine göre renk rozetleri).

### 3. 🖨️ Toner ve Sarf Malzeme Takibi
- Model, renk ve kritik eşik bazında toner stok takibi.
- Kullanıcı ve yazıcı bazında çıkış logları, sayaç (sayfa sayısı) kayıtları.
- Kritik seviyeye inen tonerler için otomatik sistem alarmları.

### 4. 📦 Kargo ve Lojistik Yönetimi
- Gelen ve Giden kargoların kurye, takip no, irsaliye ve alıcı bilgileriyle kaydedilmesi.
- Kargo hareketine doğrudan bağlı servis fişi ve zimmetli cihaz ilişkilendirme.
- Termal yazıcılar için tek tıkla standart kargo gönderi/kabul etiketi basımı.

### 5. 🔐 BitLocker Anahtar Kasası
- Kurumsal bilgisayarların BitLocker kurtarma anahtarları (Recovery Key) ve Key ID kayıtları.
- Şifreli metin yedekleri, TXT/PDF dosya ekleri ve hızlı panoya kopyalama desteği.

### 6. 🛡️ Periyodik Bakım Yönetimi
- İşletme ve dönem bazında periyodik donanım ve yazılım bakım planları.
- 9 zorunlu kontrol adımı (Toz temizliği, fan, portlar, antivirüs, lisans, performans vb.).
- İşletme Müdürü ve Teknisyen imzalı resmi Excel/PDF teslim tutanağı ve detaylı teknik kontrol raporu.

### 7. 👤 360 Derece Kullanıcı Görünümü (User360)
- Bir personelin üzerine zimmetli tüm cihazlar, geçmiş servis kayıtları, toner teslimatları ve kargo geçmişi tek ekranda.

### 8. 💬 Dahili İletişim & Bito AI Asistan
- Ekranın sağ altına sıfır oturan modern masaüstü sohbet barı.
- IT personeli arasında anlık mesajlaşma (*Socket.IO* tabanlı).
- Kurumsal verileri analiz edebilen yapay zeka operasyon asistanı (**Bito AI**).

### 9. 🔔 Web Push Bildirimleri & Özelleştirilebilir Temalar
- Arka planda çalışan VAPID destekli masaüstü / tarayıcı bildirimleri.
- Koyu, Açık, Cyberpunk, Aurora, Sakura gibi onlarca canlı tema seçeneği.

---

## 🚀 Hızlı Başlangıç & Kurulum

### Gereksinimler
- **Node.js**: v18.0.0 veya üzeri
- **MySQL / MariaDB**: v8.0 veya üzeri
- **npm** veya **yarn**

### 1. Depoyu İndirin
```bash
git clone https://github.com/your-username/servicetracker.git
cd servicetracker
```

### 2. Bağımlılıkları Yükleyin
```bash
npm install
```

### 3. Veritabanını Hazırlayın
MySQL sunucunuza bağlanın ve proje kök dizinindeki `database_schema.sql` dosyasını çalıştırın:
```bash
mysql -u root -p < database_schema.sql
```
*Bu komut `servicetracker_db` adında temiz bir veritabanı oluşturur, tabloları hazırlar ve varsayılan yönetici hesabını ekler.*

### 4. Çevre Değişkenlerini Tanımlayın
Kök dizindeki `.env.example` dosyasını `.env` olarak kopyalayın:
```bash
cp .env.example .env
```
`.env` dosyasını açıp kendi MySQL bağlantı bilgilerinizi girin:
```env
PORT=9999
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=your_password
DB_NAME=servicetracker_db
```

### 5. Uygulamayı Başlatın
* **Geliştirme Modu (Frontend + Backend):**
  ```bash
  npm run dev
  ```
* **Sadece Web / Sunucu Modu:**
  ```bash
  node server/server.js
  ```
* **Üretim (Production) Derlemesi:**
  ```bash
  npm run build
  ```

---

## 🔑 Varsayılan Giriş Bilgileri

Kurulum tamamlandığında aşağıdaki varsayılan hesapla sisteme giriş yapabilirsiniz:

| Alan | Bilgi |
|---|---|
| **Kullanıcı Adı** | `admin` |
| **Şifre** | `admin123` |
| **Rol** | `Super Admin` (Tam Yetki) |

> ⚠️ **Güvenlik Uyarısı:** Sisteme ilk giriş yaptıktan sonra lütfen **Profil** veya **Ayarlar -> Kullanıcı Yönetimi** bölümünden şifrenizi değiştiriniz.

---

## 🌐 Snipe-IT Entegrasyonu (İsteğe Bağlı)

Eğer mevcut bir Snipe-IT envanter sunucunuz varsa:
1. `admin` kullanıcısıyla sisteme giriş yapın.
2. Sağ üstteki **Ayarlar ➔ Genel Ayarlar** sekmesine gidin.
3. **Snipe-IT Sunucu URL** ve **API Anahtarınızı** girip kaydedin.
4. Sistem otomatik olarak kullanıcı ve demirbaş verilerini çekmeye başlayacaktır.

---

## 📦 Canlı Sunucu Dağıtımı (PM2 & Nginx)

Uygulamanın Linux sunucuda servis olarak arka planda kesintisiz çalışması için `PM2` önerilir:

```bash
# PM2 Kurulumu
npm install -g pm2

# Servisi Başlatma
pm2 start server/server.js --name "servicetracker"
pm2 save
pm2 startup
```

**Nginx Reverse Proxy Örneği:**
```nginx
server {
    listen 80;
    server_name servis.sirketiniz.com;

    location / {
        proxy_pass http://127.0.0.1:9999;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 📄 Lisans

Bu proje [MIT Lisansı](LICENSE) kapsamında açık kaynak olarak paylaşılmıştır. Ticari veya kişisel amaçlarla özgürce kullanılabilir, geliştirilebilir ve dağıtılabilir.
