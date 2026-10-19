// Teknik Ofis Kuralları Veri Havuzu

export const OFFICE_RULES_CATEGORIES = [
  { id: 'all', label: 'Tüm Kurallar', icon: '📋' },
  { id: 'operations', label: 'Operasyon & Sevk', icon: '📦' },
  { id: 'technical', label: 'Teknik & Altyapı', icon: '💻' },
  { id: 'discipline', label: 'Disiplin & İletişim', icon: '🎯' },
];

export const OFFICE_RULES = [
  {
    id: 1,
    category: 'operations',
    categoryLabel: 'Operasyon & Sevk',
    badge: 'Kritik Kodlar',
    badgeColor: '#3b82f6',
    icon: '🏢',
    title: 'Lokasyon & İşletme Kodları',
    summary: 'Tüm iç yazışma, çağrı karşılama ve etiketlemelerde şirket işletme kodları (G10, B11 vb.) esas alınır.',
    content: [
      'Şirket bünyesindeki tüm işletme kodları (Örn: L01 Merkez, L02 Fabrika vb.) ve lokasyon karşılıkları ilk hafta içinde eksiksiz öğrenilecektir.',
      'Tüm iç yazışma, çağrı karşılama ve cihaz etiketlemelerinde bu kodlar esas alınır.'
    ],
    highlight: 'İlk hafta içinde eksiksiz öğrenilmelidir.'
  },
  {
    id: 2,
    category: 'operations',
    categoryLabel: 'Operasyon & Sevk',
    badge: 'Sevkiyat Disiplini',
    badgeColor: '#f59e0b',
    icon: '📦',
    title: 'Kargo & Sevk Disiplini',
    summary: 'Eksiksiz irsaliye ve doğru adres etiketi olmadan hiçbir malzeme ofis dışına çıkarılamaz veya kargoya verilemez.',
    content: [
      'Hiçbir donanım veya sarf malzeme; üzerinde eksiksiz doldurulmuş sevk irsaliyesi ve doğru adres etiketi olmadan ofis dışına çıkarılamaz, kargoya verilemez.',
      'Kargo teslim tutanakları ve takip numaraları aynı gün ilgili takip tablosuna/sistemine işlenecektir.'
    ],
    highlight: 'Aynı gün sisteme işleme zorunluluğu vardır.'
  },
  {
    id: 3,
    category: 'operations',
    categoryLabel: 'Operasyon & Sevk',
    badge: 'Zimmet Güvencesi',
    badgeColor: '#10b981',
    icon: '🔐',
    title: 'Envanter & Zimmet Yetkisi',
    summary: 'Yönetici onayı ve imzalı zimmet formu olmadan hiçbir demirbaş kullanıcıya teslim edilmez ya da raftan çıkartılamaz.',
    content: [
      'Hiçbir demirbaş (Masaüstü/Dizüstü PC, monitör, klavye, mouse, kablo vb.), ilgili yöneticinin onayı ve zimmet formu imzalatılmadan kullanıcılara teslim edilmeyecek ya da raftan/depodan çıkartılmayacaktır.'
    ],
    highlight: 'İmzasız ve onaysız teslimat kesinlikle yasaktır.'
  },
  {
    id: 4,
    category: 'discipline',
    categoryLabel: 'Disiplin & İletişim',
    badge: 'Kurumsal İletişim',
    badgeColor: '#8b5cf6',
    icon: '📞',
    title: 'Çağrı & Talep Yönetimi',
    summary: 'Çağrılar kurumsal bir dille karşılanır; eksiksiz not alınır ve yetki aşımı/yanıltıcı bilgi kesinlikle verilmez.',
    content: [
      'Departmana gelen çağrılar kurumsal bir karşılama diliyle açılacak; kullanıcının adı, departmanı ve yaşadığı problem net şekilde not edilecektir.',
      'Çözümü bilinmeyen ya da yetki gerektiren konularda kullanıcıya yanıltıcı bilgi verilmeyecek, durum derhal kıdemli personele aktarılacaktır.'
    ],
    highlight: 'Kullanıcıya yanıltıcı bilgi verilmez, kıdemliye aktarılır.'
  },
  {
    id: 5,
    category: 'technical',
    categoryLabel: 'Teknik & Altyapı',
    badge: 'Altyapı Güvenliği',
    badgeColor: '#ef4444',
    icon: '🛑',
    title: 'Yetkisiz Değişiklik & Kurulum',
    summary: 'Canlı sistemler, switch, modem ve Domain Controller üzerinde onaysız hiçbir konfigürasyon değişikliği yapılamaz.',
    content: [
      'Canlı sistemler, ağ altyapısı (switch, modem vb.) veya domain controller üzerinde kıdemli personelin gözetimi ve onayı olmadan hiçbir konfigürasyon değişikliği yapılmayacaktır.'
    ],
    highlight: 'Kıdemli gözetimi ve onayı olmadan müdahale edilemez.'
  },
  {
    id: 6,
    category: 'technical',
    categoryLabel: 'Teknik & Altyapı',
    badge: 'Veri Bütünlüğü',
    badgeColor: '#06b6d4',
    icon: '💾',
    title: 'Format & İmaj Öncesi Yedek',
    summary: 'Kullanıcı verisi ve kurumsal yedekler doğrulanıp güvenli alana alınmadan hiçbir format veya sıfırlama başlatılamaz.',
    content: [
      'Bakıma veya formata gelen hiçbir cihaza, kullanıcı verisi ve kurumsal yedekler doğrulanıp güvenli alana alınmadan format/sıfırlama işlemi başlatılmayacaktır.'
    ],
    highlight: 'Yedek doğrulanmadan format kesinlikle başlatılamaz.'
  },
  {
    id: 7,
    category: 'operations',
    categoryLabel: 'Operasyon & Sevk',
    badge: 'Ofis & Depo Düzeni',
    badgeColor: '#f97316',
    icon: '🏷️',
    title: 'Hurda & Arızalı Cihaz Ayrımı',
    summary: 'Dönen donanımlar test edilerek Sağlam/Arızalı/Hurda olarak etiketlenir; masalarda cihaz ve dağınık kablo bırakılamaz.',
    content: [
      'Ofise dönen arızalı veya boşa çıkan donanımlar test edilmeden bir kenara atılmayacak; "Sağlam", "Arızalı" veya "Hurda" olarak etiketlenip ayrılmış depo alanına konulacaktır.',
      'Format, donanım montajı veya test işlemi biten cihazlar masalarda dağınık bırakılmayacak, kablolar toplanıp cihaz ait olduğu raf veya dolaba kaldırılacaktır.'
    ],
    highlight: 'Her cihaz etiketlenmeli ve ait olduğu rafa kaldırılmalıdır.'
  },
  {
    id: 8,
    category: 'discipline',
    categoryLabel: 'Disiplin & İletişim',
    badge: 'Risk Yönetimi',
    badgeColor: '#eab308',
    icon: '💡',
    title: '"Bilmiyorum" Disiplini',
    summary: 'Emin olunmayan hiçbir işlemde tahmine dayalı hareket edilmez; risk oluşturabilecek adımlarda doğrudan kıdemliye danışılır.',
    content: [
      'Emin olunmayan hiçbir işlemde tahmine dayalı hareket edilmeyecek; sistemde risk oluşturabilecek adımlarda doğrudan ekipteki kıdemlilere danışılacaktır.'
    ],
    highlight: 'Tahmin yürütmek yerine kıdemliye danışmak esastır.'
  },
  {
    id: 9,
    category: 'technical',
    categoryLabel: 'Teknik & Altyapı',
    badge: 'Lisans Güvenliği',
    badgeColor: '#6366f1',
    icon: '🛡️',
    title: 'Kurulum ve Lisans Standartları',
    summary: 'Yalnızca departman onaylı standart yazılım ve imajlar kurulur; lisanssız veya üçüncü taraf program kurulumu yapılamaz.',
    content: [
      'Bilgisayarlara yalnızca departman tarafından onaylanmış standart yazılımlar ve imajlar kurulacaktır.',
      'Kullanıcı talebi olsa dahi denetimsiz, lisanssız veya üçüncü taraf program kurulumu yapılmayacaktır.'
    ],
    highlight: 'Kullanıcı talep etse bile lisanssız yazılım kurulamaz.'
  },
  {
    id: 10,
    category: 'discipline',
    categoryLabel: 'Disiplin & İletişim',
    badge: 'İletişim & Geri Bildirim',
    badgeColor: '#ec4899',
    icon: '📋',
    title: 'Görev Alma, Teyit ve Raporlama Disiplini (İletişim Kaçaklarını Önleme)',
    summary: 'Sözlü talimatlar anında sözlü teyit edilir; tamamlanan ya da engelle karşılaşılan her iş gecikmeden raporlanır.',
    content: [
      'Kıdemli uzmanlar veya yöneticiler tarafından verilen her sözlü talimat (örn: "Şu kişinin yanına git", "Şu kasayı al"), stajyer tarafından anında sözlü olarak teyit edilecek ve gerekiyorsa not alınacaktır. ("Anladım abi, İsmail Bey\'in yanına gidiyorum" gibi).',
      'Bir görev tamamlandığında, tamamlanamadığında veya bir engelle karşılaşıldığında; işi veren kıdemliye derhal bilgi verilecektir. Bilgilendirmesi yapılmamış hiçbir iş "yapıldı" kabul edilmez.',
      'İlgili kişinin yanına gidildiğinde kişi yerinde yoksa, toplantıdaysa vb., iş kendi kendine iptal edilmiş sayılamaz; durum anında görevi veren kişiye bildirilecektir.'
    ],
    highlight: 'Bilgilendirmesi yapılmamış hiçbir iş "yapıldı" kabul edilmez.'
  },
  {
    id: 11,
    category: 'discipline',
    categoryLabel: 'Disiplin & İletişim',
    badge: 'Karakter & Etik',
    badgeColor: '#dc2626',
    icon: '⚖️',
    title: 'Dürüstlük, İş Takibi ve Bahane Kültürü',
    summary: 'Görevi yapmamak, yapmadığı işi yaptı demek veya bahanelerin arkasına sığınmak kabul edilemez bir ihlaldir; açık ve dürüst olmak zorunludur.',
    content: [
      'Verilen bir göreve gitmemek, yapmadığı bir işi "yaptım/gittim" diyerek yanlış beyan etmek ve sonrasında "böyle dememiştin" gibi bahanelerin arkasına sığınılması kabul edilemez bir kural ihlalidir.',
      'Anlaşılmayan bir talimat varsa o anda tekrar sorulmalı; görevin yapılmaması veya yanlış yapılması durumunda ise dürüstçe durum izah edilmelidir. Yanıltıcı beyan doğrudan staj değerlendirme notuna ve stajyerin süreçlerine yansıtılır.'
    ],
    highlight: 'Yanıltıcı beyan doğrudan staj değerlendirmesine yansıtılır.'
  }
];
