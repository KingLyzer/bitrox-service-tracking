// ServiceTracker Modül Bazlı Kullanım Sihirbazı Veri Havuzu

export const MODULE_GUIDES = {
  Dashboard: {
    id: 'Dashboard',
    title: 'Genel Bakış & Dashboard',
    badge: 'Ana Kontrol Merkezi',
    icon: '📊',
    color: '#3b82f6',
    description: 'Tüm teknik servis operasyonlarını, açık fişleri, bekleyen yedek parçaları ve kritik sistem metriklerini tek ekrandan anlık takip edin.',
    steps: [
      {
        title: '📊 Günlük KPI Kartları & Özet',
        icon: '⚡',
        desc: 'En üstteki özet kartları ile bugün açılan yeni fişleri, işlemdeki cihazları, bekleyen parça adetlerini ve tamamlanan servis oranını anlık olarak izleyin.',
        tips: 'Kartlara tıklayarak doğrudan ilgili durumdaki fiş listesine hızlı filtre uygulayabilirsiniz.'
      },
      {
        title: '🛠️ Son Açılan Servis Kayıtları',
        icon: '📋',
        desc: 'Sisteme en son girilen teknik servis kayıtları durum rozetleri ve öncelik renkleriyle listelenir. Çift tıklayarak doğrudan fiş detayına gidebilirsiniz.',
        tips: 'Acil öncelikli fişler kırmızı yanıp sönen rozetle en üstte dikkat çeker.'
      },
      {
        title: '📦 Bekleyen Parça & Kritik Stok Alarmları',
        icon: '⚠️',
        desc: 'Serviste parça bekleyen cihazlar ile stoğu kritik eşiğin altına düşen yedek parça ve tonerler bu panelde otomatik olarak listelenir.',
        tips: 'Kritik stok seviyesine ulaşan ürünler için doğrudan tedarikçi sipariş notu alabilirsiniz.'
      },
      {
        title: '📈 Haftalık & Aylık Arıza İstatistikleri',
        icon: '📉',
        desc: 'Şirket ve birim bazlı arıza yoğunluğu, en sık arızalanan cihaz modelleri ve ortalama tamir süreleri grafiklerle analiz edilir.',
        tips: 'En çok sorun çıkaran cihaz serilerini tespit ederek önleyici bakım planı oluşturabilirsiniz.'
      }
    ]
  },

  ServiceTickets: {
    id: 'ServiceTickets',
    title: 'Teknik Servis Fişleri',
    badge: 'Arıza & Onarım Takibi',
    icon: '🔧',
    color: '#0ea5e9',
    description: 'Arızalı cihazların kabulünden onarımına, parça değişiminden müşteri teslimatına kadar tüm teknik servis sürecini yönetin.',
    steps: [
      {
        title: '➕ Yeni Servis Fişi Oluşturma',
        icon: '📄',
        desc: 'Şerit menüdeki "Yeni" butonuna veya klavyeden hızlı kısayola basarak saniyeler içinde yeni servis fişi açın. Barkod veya personel adı yazdığınızda Snipe-IT envanterinden cihaz otomatik eşleşir.',
        tips: 'Cihazın seri numarasını veya barkodunu okutarak zimmetli personeli otomatik çekebilirsiniz.'
      },
      {
        title: '🔄 Fiş Durumu & Aşama Yönetimi',
        icon: '⚙️',
        desc: 'Fiş durumunu (Yeni Kayıt ➔ Onarımda ➔ Parça Bekliyor ➔ Dış Serviste ➔ Kurulum Bekliyor ➔ Teslim Edildi / Tamamlandı) tek tıkla güncelleyin.',
        tips: 'Durum değiştikçe sistem arka planda SMS ve e-posta ile ilgili personele otomatik bilgilendirme gönderir.'
      },
      {
        title: '🔩 Kullanılan Yedek Parçalar & İşçilik',
        icon: '🛠️',
        desc: 'Fiş detayında cihaza takılan RAM, SSD, Adaptör vb. parçaları stoktan seçip ekleyin. Eklenen parçalar yerel stoktan anında düşülür ve maliyet hesaplanır.',
        tips: 'Hatalı eklenen parçayı sildiğinizde sistem parça stoğunu otomatik olarak depoya geri iade eder.'
      },
      {
        title: '🖨️ Servis Fişi & Teslim Tutanağı Yazdırma',
        icon: '🖨️',
        desc: 'Şerit menüdeki "Yazdır" butonuyla kurumsal başlıklı, barkodlu, teknisyen ve teslim alan imzalı resmi A4 servis fiş çıktısı alın.',
        tips: 'Yazdırma penceresi tüm cihaz ve yapılan işlem detaylarını resmi teslim formatında PDF olarak da kaydeder.'
      }
    ]
  },

  Toner: {
    id: 'Toner',
    title: 'Sarf Malzeme & Toner Takibi',
    badge: 'Yazıcı & Sarf Yönetimi',
    icon: '🖨️',
    color: '#8b5cf6',
    description: 'Yazıcı tonerlerinin stok seviyelerini, birim maliyetlerini, personellere yapılan çıkış geçmişini ve Snipe-IT senkronizasyonunu yönetin.',
    steps: [
      {
        title: '📦 Toner Stokları & Kritik Eşikler',
        icon: '🏷️',
        desc: '"Sarf Stok" sekmesinde mevcut tüm toner modelleri, renkleri, depo konumları ve güncel adetleri listelenir. Kritik seviyedeki tonerler sarı/kırmızı uyarı verir.',
        tips: 'Kart görünümü (📱) ve Tablo görünümü (📊) arasında geçiş yaparak dilediğiniz düzende çalışabilirsiniz.'
      },
      {
        title: '🔄 Hızlı Toner Çıkışı & Değişim Kaydı',
        icon: '⚡',
        desc: '"Değişim" butonuna basarak personele verilen toneri seçin, adedi girin ve tek tıkla kaydedin. Hem ServiceTracker hem Snipe-IT consumable stoğu anında güncellenir.',
        tips: 'Personele toner çıkışı yapılırken varsa eski yazıcı kaydı ve özel teknisyen notu da eklenebilir.'
      },
      {
        title: '🕒 Detaylı Değişim Geçmişi',
        icon: '📋',
        desc: '"Değişim Geçmişi" sekmesinden hangi personele, hangi tarihte, kaç adet toner verildiğini geriye dönük arayabilir ve filtreleyebilirsiniz.',
        tips: 'Bitro AI asistanına "Esra Çantaş\'a hangi tonerleri verdik?" gibi sorular sorarak geçmişe saniyeler içinde ulaşabilirsiniz.'
      },
      {
        title: '🔄 Canlı Snipe-IT Senkronizasyonu',
        icon: '☁️',
        desc: '"Snipe-IT Senkronize" butonuna basarak merkezi sunucudaki sarf malzeme stokları, yeni kategoriler ve tüketim sayıları ile anlık eşitleme sağlayın.',
        tips: 'Yeni sarf malzemesi eklerken kategori seçildiğinde Snipe-IT üzerinde de otomatik sarf kartı açılır.'
      }
    ]
  },

  Stock: {
    id: 'Stock',
    title: 'Stok & Yedek Parça Takibi',
    badge: 'Depo & Parça Yönetimi',
    icon: '📦',
    color: '#10b981',
    description: 'Teknik serviste kullanılan RAM, SSD, Adaptör, Kablo, Ekran Kartı gibi tüm yedek parçaların stok giriş/çıkış ve depo hareketlerini yönetin.',
    steps: [
      {
        title: '📋 Yedek Parça Listesi & Kategoriler',
        icon: '🔍',
        desc: 'Tüm parçalar kategori, marka, model, birim fiyat ve mevcut adet bilgileriyle listelenir. Arama çubuğu ile parça adına veya koduna göre anında filtreleyin.',
        tips: 'Kategori bazlı filtreleme ile sadece diskleri veya sadece güç kaynaklarını listeleyebilirsiniz.'
      },
      {
        title: '📥 Stok Girişi & Manuel Düşüm',
        icon: '➕',
        desc: 'Yeni satın alınan parçaları stoğa ekleyebilir veya servis dışı parça çıkışlarını gerekçe belirterek kaydedebilirsiniz.',
        tips: 'Servis fişine eklenen parçalar bu stoktan otomatik düşer, manuel düşmenize gerek kalmaz.'
      },
      {
        title: '⚠️ Kritik Seviye Alarmları',
        icon: '🚨',
        desc: 'Belirlediğiniz kritik miktarın altına inen parçalar listede kırmızı arka plan ve uyarı rozetiyle öne çıkarılır.',
        tips: 'Raporlar modülünden tek tıkla "Kritik Parça Sipariş Listesi" Excel dökümü alabilirsiniz.'
      }
    ]
  },

  Maintenance: {
    id: 'Maintenance',
    title: 'Periyodik Bakım Yönetimi',
    badge: 'Önleyici Bakım & Kontrol',
    icon: '🛡️',
    color: '#f59e0b',
    description: 'Şirket bünyesindeki tüm bilgisayar ve ekipmanların 6 aylık veya yıllık periyodik bakım planlarını, 11 maddelik kontrol listesini ve teslim tutanaklarını yönetin.',
    steps: [
      {
        title: '📋 Yeni Bakım Planı Başlatma',
        icon: '🚀',
        desc: '"Yeni Bakım Planı" butonuna basarak ilgili şirketi (örn: Örnek Teknoloji A.Ş.) ve dönemi seçin. Sistem şirkete ait tüm zimmetli bilgisayarları otomatik plana dahil eder.',
        tips: 'İsterseniz sadece belirli bir lokasyon veya departman için özel bakım planı da açabilirsiniz.'
      },
      {
        title: '⚡ 11 Maddelik Cihaz Kontrol Listesi',
        icon: '✅',
        desc: 'Cihazın yanındaki "⚡ Bakımı Yap" butonuna basarak Toz Temizliği, Fan, Performans, Antivirüs, Lisans, Ağ ve Standart Yazılımlar gibi 11 zorunlu/opsiyonel maddeyi kontrol edip onaylayın.',
        tips: '"Tüm Zorunluları İşaretle" butonu ile standart bakımı saniyeler içinde tamamlayabilirsiniz.'
      },
      {
        title: '📊 İlerleme & Tamamlanma Takibi',
        icon: '📈',
        desc: 'Plana dahil edilen toplam cihaz sayısı, tamamlanan ve kalan bilgisayarlar dinamik ilerleme çubuğunda anlık güncellenir.',
        tips: 'Plan detayında arama kutusuna personel adı veya barkod yazarak cihazı anında bulabilirsiniz.'
      },
      {
        title: '📑 Excel Raporu & Resmi Bakım Tutanağı',
        icon: '🖨️',
        desc: 'Bakım planı tamamlandığında tek tıkla kurumsal başlıklı "Periyodik Bakım Teslim Tutanağı" PDF çıktısını ve yönetim için Excel raporunu indirin.',
        tips: 'Resmi tutanakta cihazın seri no, bakım tarihi, teknisyen adı ve tüm 11 kontrol maddesi eksiksiz yer alır.'
      }
    ]
  },

  Inventory: {
    id: 'Inventory',
    title: 'Envanter & Demirbaş Takibi',
    badge: 'Snipe-IT Canlı Cihazlar',
    icon: '🖥️',
    color: '#06b6d4',
    description: 'Şirketin tüm masaüstü, laptop, monitör, yazıcı ve ağ cihazlarını canlı Snipe-IT veritabanı üzerinden anlık takip edin.',
    steps: [
      {
        title: '💻 Canlı Demirbaş Listesi',
        icon: '🏷️',
        desc: 'Varlık etiketi (Asset Tag), Seri No, Marka/Model, Zimmetli Personel ve Fiziksel Lokasyon bilgileriyle tüm cihazlar tek ekranda.',
        tips: 'Arama kutusuna barkod okuttuğunuzda ilgili cihaz anında filtrelenir.'
      },
      {
        title: '👤 Personel Zimmet Durumu',
        icon: '🧑‍💼',
        desc: 'Hangi cihazın kime zimmetli olduğunu, boşta bekleyen depodaki cihazları veya tamirdeki varlıkları renkli durum rozetleriyle görün.',
        tips: 'Boştaki cihazları listeleyerek yeni işe başlayan personele hızlı bilgisayar tahsis edebilirsiniz.'
      },
      {
        title: '🔧 Doğrudan Servis Fişi Açma',
        icon: '⚡',
        desc: 'Herhangi bir cihaza tıklandığında cihaz bilgileri doldurulmuş olarak tek tıkla doğrudan arıza/servis fişi başlatabilirsiniz.',
        tips: 'Cihaz geçmişi sekmesinden bu bilgisayarın daha önce kaç kez servise geldiğini görebilirsiniz.'
      }
    ]
  },

  Users: {
    id: 'Users',
    title: 'Personel & Kullanıcı Yönetimi',
    badge: 'Zimmet & Kullanıcı Analizi',
    icon: '🧑‍💻',
    color: '#ec4899',
    description: 'Şirket çalışanlarının departman ve lokasyon bilgilerini, üzerlerine zimmetli demirbaşları ve geçmiş arıza kayıtlarını inceleyin.',
    steps: [
      {
        title: '👥 Personel Listesi & Filtreleme',
        icon: '🔍',
        desc: 'Şirket veya departman bazında çalışanları listeleyin. Personelin e-posta, telefon ve unvan bilgilerine anında erişin.',
        tips: 'Arama kutusu ad, soyad ve kullanıcı adına göre akıllı arama yapar.'
      },
      {
        title: '💻 Zimmetli Ekipmanlar',
        icon: '🖥️',
        desc: 'Seçilen personelin üzerine zimmetli bilgisayar, monitör, telefon ve çevre birimlerini tam detaylarıyla görüntüleyin.',
        tips: 'Personel işten ayrılırken zimmet dökümünü tek tıkla tutanak olarak yazdırabilirsiniz.'
      },
      {
        title: '🛠️ Kullanıcı Arıza & Servis Geçmişi',
        icon: '📈',
        desc: 'Personelin bugüne kadar açtığı tüm servis fişlerini, arıza tiplerini ve çözüm geçmişini kronolojik olarak inceleyin.',
        tips: 'Kullanıcının en sık yaşadığı arıza tipleri grafik olarak özetlenir.'
      }
    ]
  },

  DocsAndLabels: {
    id: 'DocsAndLabels',
    title: 'Tutanak & Adres Etiketi',
    badge: 'Resmi Evrak & Kargo Baskısı',
    icon: '✍️',
    color: '#14b8a6',
    description: 'Şubeler ve tedarikçiler arası kargo etiketleri ile personellere teslim edilen cihazların resmi teslim-tesellüm tutanaklarını tek ekranda yönetin.',
    steps: [
      {
        title: '🏷️ Kargo & Adres Etiketi',
        icon: '📦',
        desc: 'Snipe-IT kullanıcı veya lokasyonlarından alıcı ve göndericiyi seçin. 100x150 mm termal etiket veya A4 kargo etiketini tek tıkla yazdırın.',
        tips: '"Gönderici ⇋ Alıcıyı Değiştir" butonu ile iki tarafı anında takas edebilirsiniz.'
      },
      {
        title: '✍️ Zimmet & Teslim Tutanağı',
        icon: '📋',
        desc: 'Personele teslim edilen bilgisayar, monitör ve aksesuarları otomatik seçin; ıslak imzalı resmi kurumsal A4 teslim tutanağı oluşturun.',
        tips: 'Personel adını yazdığınızda üzerine zimmetli tüm cihazlar otomatik listelenir.'
      },
      {
        title: '🚨 Kırılabilir Damgası & Özel Notlar',
        icon: '⚠️',
        desc: 'Hassas kargo gönderilerinde "DİKKAT KIRILIR" damgasını ve sipariş/takip notlarını etikete dahil edin.',
        tips: 'Bitro AI sohbetine "Esra Çantaş için kargo etiketi hazırla" dediğinizde etiket otomatik doldurulur.'
      }
    ]
  },

  AddressLabel: {
    id: 'AddressLabel',
    title: 'Adres & Kargo Etiketi',
    badge: 'Termal & A4 Etiket Baskısı',
    icon: '🏷️',
    color: '#14b8a6',
    description: 'Şubeler ve tedarikçiler arası kargo ve sevkiyatlar için profesyonel adres etiketleri hazırlayın ve yazdırın.',
    steps: [
      {
        title: '🏢 Alıcı & Gönderici Şablonları',
        icon: '📑',
        desc: 'Sık kullanılan şirket şubeleri, fabrikalar ve kargo adreslerini kayıtlı şablonlardan tek tıkla seçin.',
        tips: 'Bitro AI sohbetine "Esra Hanım için kargo etiketi bas" yazdığınızda etiket otomatik doldurulur.'
      },
      {
        title: '📐 Çoklu Kağıt & Boyut Desteği',
        icon: '🖨️',
        desc: '100x150 mm termal etiket, 100x100 mm kare etiket veya A4 sayfada çoklu etiket düzeninde baskı alabilirsiniz.',
        tips: 'Termal yazıcılar için önizleme ölçeği %100 birebir piksel hassasiyetinde hazırlanmıştır.'
      },
      {
        title: '📦 Kargo & Takip Notları',
        icon: '✍️',
        desc: 'Etiket üzerine "Kırılabilir Malzeme ⚠️", "Dikkatli Taşıyınız", sipariş no veya alıcı irtibat telefonu ekleyin.',
        tips: 'Barkod formatı kargo firmalarının optik okuyucuları ile tam uyumludur.'
      }
    ]
  },

  HandoverProtocol: {
    id: 'HandoverProtocol',
    title: 'Teslim Tutanağı & Formlar',
    badge: 'Resmi Zimmet & İade Evrakı',
    icon: '✍️',
    color: '#f97316',
    description: 'Personele cihaz teslim ederken veya geri alırken ıslak imzalı veya dijital onaylı resmi teslim-tesellüm tutanakları oluşturun.',
    steps: [
      {
        title: '📋 Protokol Tipi & Personel Seçimi',
        icon: '👤',
        desc: 'Zimmet Teslimi, İade Alımı veya Hurda/Pert Tutanak türünü seçip personeli belirleyin.',
        tips: 'Personel seçildiğinde üzerine kayıtlı cihazlar otomatik olarak listeye dahil edilir.'
      },
      {
        title: '💻 Donanım & Aksesuar Detayları',
        icon: '🔌',
        desc: 'Cihazla birlikte teslim edilen adaptör, çanta, mouse, güç kablosu gibi aksesuarları ve cihazın fiziksel kondisyonunu işaretleyin.',
        tips: 'Varsa kasadaki çizik veya hasar notlarını tutanağa ekleyerek yasal güvence sağlayın.'
      },
      {
        title: '📄 İmzalı PDF & A4 Baskı',
        icon: '🖨️',
        desc: 'Teslim eden ve teslim alan imza alanlarını içeren resmi kurumsal A4 tutanak çıktısını tek tıkla alın veya PDF olarak arşivleyin.',
        tips: 'Oluşturulan tutanaklar sistemde dijital olarak arşivlenir ve istendiğinde tekrar yazdırılabilir.'
      }
    ]
  },

  FilesManager: {
    id: 'FilesManager',
    title: 'Dosyalar & Ağ Deposu (SMB)',
    badge: 'Merkezi Dosya Paylaşımı',
    icon: '📁',
    color: '#6366f1',
    description: 'Şirket içi kurulum dosyalarını, ISO kalıplarını, lisans evraklarını ve sürücüleri ortak depodan hızlıca paylaşın ve indirin.',
    steps: [
      {
        title: '📂 Klasör Ağacı & Dosya Gezgini',
        icon: '🗂️',
        desc: 'Windows SMB ağ paylaşımı veya yerel sunucu üzerindeki klasörleri çift tıklayarak gezin, yeni klasör oluşturun veya dosya yükleyin.',
        tips: 'Sürükle-bırak desteği ile masaüstünüzden dosyaları doğrudan tarayıcıya bırakabilirsiniz.'
      },
      {
        title: '🔗 Şifreli & Süreli Paylaşım Linki',
        icon: '🌐',
        desc: 'Büyük boyutlu kurulum dosyalarını veya klasörleri tek tıkla linke dönüştürün. İsterseniz şifre ve geçerlilik süresi (örn: 7 gün) belirleyin.',
        tips: 'Paylaşım linki oluşturulduğunda kullanıcılar sisteme giriş yapmadan doğrudan tarayıcıdan indirebilir.'
      },
      {
        title: '👁️ Anlık Önizleme & İndirme',
        icon: '⬇️',
        desc: 'PDF, Resim, TXT dosyalarını indirmeden tarayıcıda önizleyin; ZIP ve kurulum dosyalarını yüksek hızda indirin.',
        tips: 'Arama çubuğu ile derin klasörlerdeki dosyaları saniyeler içinde bulabilirsiniz.'
      }
    ]
  },

  TasksModule: {
    id: 'TasksModule',
    title: 'Kurulum & IT Görevleri',
    badge: 'İş Listesi & Teknisyen Görevleri',
    icon: '📋',
    color: '#3b82f6',
    description: 'Yeni işe başlayan personel kurulumlarını, format ve yazılım taleplerini aşama aşama görev kartlarıyla yönetin.',
    steps: [
      {
        title: '➕ Yeni Kurulum Görevi Açma',
        icon: '📝',
        desc: 'Yeni gelen personelin bilgisayar kurulumu, mail açılışı, ERP yetkileri ve yazıcı tanımlarını kapsayan görev oluşturun.',
        tips: 'Şablon görevleri kullanarak standart 10 adımlık kurulum kontrol listesini tek tıkla başlatabilirsiniz.'
      },
      {
        title: '⏱️ Aşama & Teknisyen Ataması',
        icon: '👥',
        desc: 'Görevi belirli bir IT teknisyenine atayın, tamamlanan adımları işaretleyin ve teslim tarihini kaydedin.',
        tips: 'Geciken veya bekleyen görevler zaman aşımı uyarısıyla öne çıkarılır.'
      }
    ]
  },

  Settings: {
    id: 'Settings',
    title: 'Sistem & Entegrasyon Ayarları',
    badge: 'Yönetici & Güvenlik Yapılandırması',
    icon: '⚙️',
    color: '#64748b',
    description: 'Snipe-IT API bağlantısını, sistem kullanıcılarını, rol ve yetkileri, temaları ve bildirimleri yapılandırın.',
    steps: [
      {
        title: '☁️ Snipe-IT API Entegrasyonu',
        icon: '🔑',
        desc: 'Snipe-IT sunucu adresi ve API token anahtarını girerek çift yönlü canlı envanter ve sarf malzeme senkronizasyonunu aktifleştirin.',
        tips: 'Bağlantıyı Test Et butonu ile API erişiminin sağlıklı çalıştığını doğrulayabilirsiniz.'
      },
      {
        title: '👥 Kullanıcı & Rol Yönetimi',
        icon: '🛡️',
        desc: 'Teknisyen ve yöneticiler için hesaplar oluşturun, modül bazında (Görüntüleme, Oluşturma, Düzenleme, Silme) detaylı yetkiler atayın.',
        tips: 'Kullanıcıların sadece kendi birimlerindeki fişleri görmesini sağlayabilirsiniz.'
      },
      {
        title: '🎨 17 Zengin Tema & Efektler',
        icon: '✨',
        desc: 'Karanlık, Açık, Ramazan, Yılbaşı, Retro Arcade, Cyberpunk, Kahve, Aurora ve Tropik Yaz gibi 17 farklı tema arasından seçim yapın.',
        tips: 'Arka plan efektleri ve ses bildirimleri isteğe bağlı olarak açılıp kapatılabilir.'
      }
    ]
  }
};
