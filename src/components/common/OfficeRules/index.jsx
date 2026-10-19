import React, { useState, useEffect } from 'react';
import './officeRules.css';

export default function OfficeRulesModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('service_tracker_open_office_rules', handleOpen);
    window.openOfficeRules = () => setIsOpen(true);

    return () => {
      window.removeEventListener('service_tracker_open_office_rules', handleOpen);
      delete window.openOfficeRules;
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="rules-modal-overlay" onClick={(e) => e.target === e.currentTarget && setIsOpen(false)}>
      <div className="rules-modal-container" role="dialog" aria-modal="true">
        
        {/* Header */}
        <div className="rules-modal-header">
          <div>
            <h3 className="rules-header-title">
              📜 Teknik Ofis Kuralları
            </h3>
            <p className="rules-header-subtitle">
              Teknik Personel & Stajyer Çalışma Standartları (Önem Sırasına Göre)
            </p>
          </div>
          <button className="rules-close-btn" onClick={() => setIsOpen(false)} title="Kapat (ESC)">
            ✕
          </button>
        </div>

        {/* Body - Pure readable document view */}
        <div className="rules-modal-body">
          <div className="rules-doc-header">
            <h2 className="rules-doc-title">TEKNİK OFİS ÇALIŞMA KURALLARI</h2>
            <p className="rules-doc-desc">
              Tüm teknik personellerin ve stajyerlerin ofis içi ve dışı süreçlerde bilmesi, benimsemesi ve istisnasız uygulaması gereken temel ilkeler önem sırasına göre aşağıda maddelenmiştir.
            </p>
          </div>

          <div className="rules-list">
            
            {/* Madde 1 */}
            <div className="rule-item">
              <div className="rule-item-title">1. Dürüstlük, İş Takibi ve Bahane Kültürü</div>
              <ul className="rule-item-bullets">
                <li>
                  Verilen bir göreve gitmemek, yapmadığı bir işi <strong>"yaptım/gittim"</strong> diyerek yanlış beyan etmek ve sonrasında <em>"böyle dememiştin"</em> gibi bahanelerin arkasına sığınılması kabul edilemez bir kural ihlalidir.
                </li>
                <li>
                  Anlaşılmayan bir talimat varsa o anda tekrar sorulmalı; görevin yapılmaması veya yanlış yapılması durumunda ise dürüstçe durum izah edilmelidir. Yanıltıcı beyan doğrudan staj değerlendirme notuna ve personelin süreçlerine yansıtılır.
                </li>
              </ul>
            </div>

            {/* Madde 2 */}
            <div className="rule-item">
              <div className="rule-item-title">2. "Bilmiyorum" Disiplini</div>
              <p className="rule-item-text">
                Emin olunmayan hiçbir işlemde tahmine dayalı hareket edilmeyecek; sistemde risk oluşturabilecek adımlarda doğrudan ekipteki kıdemlilere danışılacaktır. Bilmemek değil, bilmediğini sormadan risk almak hatadır.
              </p>
            </div>

            {/* Madde 3 */}
            <div className="rule-item">
              <div className="rule-item-title">3. Kullanıcı Verisi & Gizlilik Disiplini (KVKK)</div>
              <p className="rule-item-text">
                Bakıma, kuruluma veya arızaya alınan cihazlardaki kullanıcı e-postaları, mesajlaşmalar (WhatsApp/Teams), bordro ve kurumsal/kişisel dosyalar hiçbir şekilde incelenemez, okunamaz, fotoğrafı çekilemez ve üçüncü şahıslarla paylaşılamaz.
              </p>
              <p className="rule-item-text">
                Kullanıcı şifreleri not kağıtlarına yazılıp masalarda açıkta bırakılmayacaktır.
              </p>
            </div>

            {/* Madde 4 */}
            <div className="rule-item">
              <div className="rule-item-title">4. Format & İmaj Öncesi Yedek</div>
              <p className="rule-item-text">
                Bakıma veya formata gelen hiçbir cihaza, kullanıcı verisi ve kurumsal yedekler doğrulanıp güvenli alana alınmadan format/sıfırlama işlemi başlatılmayacaktır. Geri dönüşü olmayan veri kaybının sorumluluğu işlemi yapan personele aittir.
              </p>
            </div>

            {/* Madde 5 */}
            <div className="rule-item">
              <div className="rule-item-title">5. Yetkisiz Değişiklik & Altyapı Müdahalesi</div>
              <p className="rule-item-text">
                Canlı sistemler, ağ altyapısı (switch, modem vb.) veya domain controller üzerinde kıdemli personelin gözetimi ve onayı olmadan hiçbir konfigürasyon değişikliği yapılmayacaktır.
              </p>
            </div>

            {/* Madde 6 */}
            <div className="rule-item">
              <div className="rule-item-title">6. Görev Alma, Teyit ve Raporlama Disiplini (İletişim Kaçaklarını Önleme)</div>
              <ul className="rule-item-bullets">
                <li>
                  Kıdemli uzmanlar veya yöneticiler tarafından verilen her sözlü talimat (örn: <em>"Şu kişinin yanına git"</em>, <em>"Şu kasayı al"</em>), stajyer tarafından anında sözlü olarak teyit edilecek ve gerekiyorsa not alınacaktır. (<em>"Anladım abi, İsmail Bey'in yanına gidiyorum"</em> gibi).
                </li>
                <li>
                  Bir görev tamamlandığında, tamamlanamadığında veya bir engelle karşılaşıldığında; işi veren kıdemliye derhal bilgi verilecektir. <strong>Bilgilendirmesi yapılmamış hiçbir iş "yapıldı" kabul edilmez.</strong>
                </li>
                <li>
                  İlgili kişinin yanına gidildiğinde kişi yerinde yoksa, toplantıdaysa vb., iş kendi kendine iptal edilmiş sayılamaz; durum anında görevi veren kişiye bildirilecektir.
                </li>
              </ul>
            </div>

            {/* Madde 7 */}
            <div className="rule-item">
              <div className="rule-item-title">7. "Ayaküstü İş Yapmama" & Servis Kaydı Disiplini</div>
              <p className="rule-item-text">
                Koridorda, yemekhanede veya sözlü olarak ayaküstü iletilen hiçbir arıza veya talep havada bırakılmayacaktır.
              </p>
              <p className="rule-item-text">
                Yapılan her müdahale ve işlem gecikmeden ServiceTracker sistemine servis fişi veya görev olarak işlenecektir. <strong>Sistemde kaydı olmayan iş, yapılmamış sayılır.</strong>
              </p>
            </div>

            {/* Madde 8 */}
            <div className="rule-item">
              <div className="rule-item-title">8. Envanter & Zimmet Yetkisi</div>
              <p className="rule-item-text">
                Hiçbir demirbaş (Masaüstü/Dizüstü PC, monitör, klavye, mouse, kablo vb.), ilgili yöneticinin onayı ve zimmet formu imzalatılmadan kullanıcılara teslim edilmeyecek ya da raftan/depodan çıkartılmayacaktır.
              </p>
            </div>

            {/* Madde 9 */}
            <div className="rule-item">
              <div className="rule-item-title">9. Kurulum ve Lisans Standartları</div>
              <p className="rule-item-text">
                Bilgisayarlara yalnızca departman tarafından onaylanmış standart yazılımlar ve imajlar kurulacaktır. Kullanıcı talebi olsa dahi denetimsiz, lisanssız veya üçüncü taraf program kurulumu yapılmayacaktır.
              </p>
            </div>

            {/* Madde 10 */}
            <div className="rule-item">
              <div className="rule-item-title">10. Kargo & Sevk Disiplini</div>
              <p className="rule-item-text">
                Hiçbir donanım veya sarf malzeme; üzerinde eksiksiz doldurulmuş sevk irsaliyesi ve doğru adres etiketi olmadan ofis dışına çıkarılamaz, kargoya verilemez. Kargo teslim tutanakları ve takip numaraları aynı gün ilgili takip tablosuna/sistemine işlenecektir.
              </p>
            </div>

            {/* Madde 11 */}
            <div className="rule-item">
              <div className="rule-item-title">11. Lokasyon & İşletme Kodları</div>
              <p className="rule-item-text">
                Şirket bünyesindeki tüm işletme kodları (Örn: L01 Merkez, L02 Şube vb.) ve lokasyon karşılıkları ilk hafta içinde eksiksiz öğrenilecektir. Tüm iç yazışma, çağrı karşılama ve cihaz etiketlemelerinde bu kodlar esas alınır.
              </p>
            </div>

            {/* Madde 12 */}
            <div className="rule-item">
              <div className="rule-item-title">12. Çağrı & Talep Yönetimi</div>
              <p className="rule-item-text">
                Departmana gelen çağrılar kurumsal bir karşılama diliyle açılacak; kullanıcının adı, departmanı ve yaşadığı problem net şekilde not edilecektir. Çözümü bilinmeyen ya da yetki gerektiren konularda kullanıcıya yanıltıcı bilgi verilmeyecek, durum derhal kıdemli personele aktarılacaktır.
              </p>
            </div>

            {/* Madde 13 */}
            <div className="rule-item">
              <div className="rule-item-title">13. Hurda & Arızalı Cihaz Ayrımı (Ofis & Depo Düzeni)</div>
              <p className="rule-item-text">
                Ofise dönen arızalı veya boşa çıkan donanımlar test edilmeden bir kenara atılmayacak; <strong>"Sağlam"</strong>, <strong>"Arızalı"</strong> veya <strong>"Hurda"</strong> olarak etiketlenip ayrılmış depo alanına konulacaktır.
              </p>
              <p className="rule-item-text">
                Format, donanım montajı veya test işlemi biten cihazlar masalarda dağınık bırakılmayacak, kablolar toplanıp cihaz ait olduğu raf veya dolaba kaldırılacaktır.
              </p>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="rules-modal-footer">
          <button className="rules-btn rules-btn-primary" onClick={() => setIsOpen(false)}>
            Tamam, Anladım
          </button>
        </div>

      </div>
    </div>
  );
}
