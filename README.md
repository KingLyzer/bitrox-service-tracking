# 🛠️ Bitrox ServiceTracker — Snipe-IT Entegre IT Servis & Envanter Yönetim Portalı

![Version](https://img.shields.io/badge/version-2.3.2-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Snipe--IT](https://img.shields.io/badge/Snipe--IT-API%20v1%20Entegre-orange.svg)
![React](https://img.shields.io/badge/React-18-61dafb.svg)
![Node](https://img.shields.io/badge/Node.js-18%2B-339933.svg)
![MySQL](https://img.shields.io/badge/MySQL-8.0%2B-4479A1.svg)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8%2B-black.svg)

**Bitrox ServiceTracker**, kurumsal IT departmanları, teknik servis birimleri ve bilgi işlem ekipleri için özel olarak tasarlanmış açık kaynaklı, beyaz etiketli (white-label) bir **IT Operasyon ve Servis Masası (Service Desk)** yönetim portalıdır.

> 💡 **Önemli Not:** Bu proje hem tek başına **bağımsız (standalone)** bir teknik servis, stok ve operasyon portalı olarak çalışabilir; hem de popüler açık kaynak envanter yönetim yazılımı **[Snipe-IT](https://snipeitapp.com/)** ile derinlemesine entegre çalışabilir. Snipe-IT demirbaş ve kullanıcı yönetimini üstlenirken; **ServiceTracker** arıza servis fişleri, toner sarf malzeme takip süreçleri, stok yönetimi, periyodik bakım takvimi, kargo lojistiği ve yapay zeka operasyon desteğini tek ekranda buluşturur.

---

## ⚡ Sistemin Kalbi: Neden Snipe-IT Entegrasyonu Kritik?

Snipe-IT, dünyada en çok tercih edilen IT demirbaş ve envanter yönetim (ITAM) platformlarından biridir. Ancak saha operasyonlarında IT ekiplerinin ihtiyaç duyduğu şu kritik süreçler Snipe-IT'de bulunmaz:

- ❌ Arıza fişi açma, teknisyen atama, yedek parça ve onarım aşamalarını takip etme,
- ❌ Islak imzalı arıza ve teslimat formları oluşturma,
- ❌ Yazıcıların toner değişim geçmişini, sayaç (sayfa) verilerini ve sarf malzeme sarfiyatını izleme,
- ❌ IT departmanına gelen/giden kargo sevkiyatlarını ve etiketleme süreçlerini yürütme,
- ❌ İşletme bazında periyodik donanım ve yazılım bakım planları hazırlayıp resmi tutanak basma.

**Bitrox ServiceTracker**, tam da bu boşluğu doldurur! Snipe-IT API'si ile iki yönlü entegrasyon kurarak tüm bu operasyonları otomatikleştirir:

### 🔗 Snipe-IT ile Entegre Çalışan Başlıca Modüller:
1. **🔧 Servis Fişleri:** Müşteri/personel seçildiğinde, o kişinin üzerine Snipe-IT'de zimmetli olan tüm bilgisayar, telefon veya monitörler otomatik olarak listelenir. Tek tıkla ilgili cihaz seçilerek seri no ve demirbaş bilgileriyle servis kabulü yapılır. (Snipe-IT kapalıyken serbest cihaz girişi yapılır).
2. **🖨️ Toner ve Sarf Takibi:** Snipe-IT'de kayıtlı olan yazıcılar, departmanlar ve kullanıcılar üzerinden sayaç loglu toner çıkışları yapılır. (Snipe-IT kapalıyken manuel personel adıyla çıkış yapılır).
3. **👤 360° Kullanıcı Görünümü (User360):** Bir personelin profiline girildiğinde; Snipe-IT'deki aktif zimmetleri (laptop, lisans, aksesuar vb.), yerel veritabanındaki servis geçmişi, toner alımları ve kargo hareketleri tek ekranda birleşir.
4. **📦 Envanter ve Cihaz Senkronizasyonu:** Snipe-IT'deki tüm cihazlar ve kullanıcılar periyodik olarak önbelleklenir (caching), böylece anlık aramalar ve filtrelemeler milisaniyeler içinde gerçekleşir.
5. **🛡️ Periyodik Bakım:** Snipe-IT'de kayıtlı kurumsal bilgisayarlar seçilerek 9 adımlı bakım protokolü uygulanır ve işletme müdürü imzalı resmi tutanaklar oluşturulur.
6. **🤖 Bito AI & Snipe-IT Asistanı:** Entegre yapay zeka asistanı, Snipe-IT veritabanını tarayarak *"Ali Yılmaz'ın üzerindeki laptop hangisi?"* veya *"Muhasebedeki arızalı cihazlar neler?"* gibi sorulara anında yanıt verir.

---

## ✨ Tüm Modüller ve Özellikler

| Modül | Açıklama |
|---|---|
| **🔧 Teknik Servis Fişleri** | Barkod/Seri no ile hızlı kayıt, durum aşamaları (*Yeni, Onarımda, Parça Bekliyor, Dış Servis, Teslim Edildi*), yedek parça maliyetleri ve PDF fiş çıktısı. |
| **🗓️ Master Operasyon Takvimi** | Servis fişleri, kargo hareketleri, toner çıkışları ve periyodik bakımların tek bir renk kodlu takvimde interaktif takibi. |
| **🖨️ Toner & Sarf Malzeme** | Model, renk, kritik stok seviyesi alarmları, yazıcı sayaç kayıtları ve departman sarfiyat analizleri. |
| **📦 Kargo & Lojistik** | Gelen ve giden kargoların kurye/takip no takibi, termal barkodlu kargo etiketi basımı. |
| **🔐 BitLocker Anahtar Kasası** | Bilgisayarların kurtarma anahtarları (Recovery Key) ve Key ID'lerinin güvenli depolanması, TXT/PDF dışa aktarımı. |
| **🛡️ Periyodik Bakım Yönetimi** | 9 zorunlu kontrol adımı (toz temizliği, antivirüs, lisans vb.) ve resmi teslim-tesellüm tutanağı. |
| **👤 360° Personel Görünümü** | Personelin tüm IT geçmişi (zimmetleri, fişleri, tonerleri, kargoları) tek sayfada. |
| **💬 Dahili Mesajlaşma & AI** | Ekranın sağ altına sıfır oturan masaüstü sohbet barı, IT ekibi içi anlık sohbet (*Socket.IO*) ve Bito AI asistanı. |
| **🔔 Web Push & Temalar** | Tarayıcı masaüstü bildirimleri ve 15+ modern görsel tema (Cyberpunk, Aurora, Sakura, Dark vb.). |

---

## 🚀 Hızlı Başlangıç & Kurulum

### Sistem Gereksinimleri
- **Node.js**: v18.0.0 veya üzeri
- **MySQL / MariaDB**: v8.0 veya üzeri
- **npm** veya **yarn**
- *(İsteğe Bağlı)* Aktif bir **Snipe-IT** sunucusu (API erişimi açık) — *Snipe-IT olmadan da tüm modüller yerel MySQL veritabanı üzerinden %100 bağımsız olarak çalışır.*

---

### 1. Depoyu Klonlayın
```bash
git clone https://github.com/KingLyzer/bitrox-service-tracking.git
cd bitrox-service-tracking
```

### 2. Bağımlılıkları Yükleyin
```bash
npm install
```

### 3. Veritabanını Kurun
MySQL sunucunuzda proje kök dizinindeki hazır `database_schema.sql` dosyasını çalıştırın:
```bash
mysql -u root -p < database_schema.sql
```
*Bu komut `servicetracker_db` adında boş, temiz bir veritabanı kurar ve varsayılan yönetici hesabını oluşturur.*

### 4. Çevre Değişkenlerini Yapılandırın
Kök dizindeki `.env.example` dosyasını kopyalayarak `.env` oluşturun:
```bash
cp .env.example .env
```
`.env` dosyasını açıp kendi MySQL veritabanı bilgilerinizi girin:
```env
PORT=9999
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=veritabani_sifreniz
DB_NAME=servicetracker_db
```

### 5. Frontend'i Derleyin ve Uygulamayı Başlatın
Web arayüzünün derlenmesi ve sunucunun yayına alınması:
```bash
# 1. Arayüzü derleyin (üretim dosyalarını dist/ klasörüne hazırlar)
npm run build

# 2. Sunucuyu başlatın
npm start
# (veya arka planda kesintisiz çalışması için: pm2 start server/server.js --name "servicetracker")
```

* **Geliştirme Ortamı (Vite + Node Server - Canlı Yenileme):**
  ```bash
  npm run dev
  ```

---

## 🔑 Varsayılan Giriş Bilgileri

Kurulum tamamlandıktan sonra tarayıcınızdan `http://localhost:9999` (veya sunucu IP adresiniz) adresine gidin:

| Alan | Varsayılan Değer |
|---|---|
| **Kullanıcı Adı** | `admin` |
| **Şifre** | `admin123` |
| **Yetki Düzeyi** | `Super Admin` |

> ⚠️ **Önemli:** Sisteme giriş yaptıktan sonra lütfen **Ayarlar ➔ Kullanıcı Yönetimi** veya **Profil** sekmesinden varsayılan şifreyi değiştiriniz.

---

## 🌐 Snipe-IT Entegrasyonunun Yapılandırılması (Adım Adım)

Sistemin servis fişi, toner ve envanter kabiliyetlerini tam kapasite kullanmak için Snipe-IT bağlantısını tanımlayın:

1. `admin` kullanıcısıyla sisteme giriş yapın.
2. Sağ üst menüden **⚙️ Ayarlar ➔ Genel Ayarlar** sayfasına gidin.
3. **Snipe-IT Entegrasyonu** bölümünü bulun:
   - **Snipe-IT Sunucu URL:** Örn: `https://envanter.sirketiniz.com`
   - **Snipe-IT API Token (Bearer Token):** Snipe-IT arayüzünden `Admin -> Manage API Keys` kısmından oluşturduğunuz token'ı yapıştırın.
4. **Kaydet** butonuna basın.
5. Sistem arka planda Snipe-IT ile el sıkışacak; kullanıcıları, demirbaşları, departman ve lokasyonları yerel önbellek tablolarına aktarmaya başlayacaktır.

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
