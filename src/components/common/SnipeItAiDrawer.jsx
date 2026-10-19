import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { getApiBase } from '../../utils/apiConfig';

export default function SnipeItAiDrawer({ isOpen, onClose }) {
  const { user, showNotification, settings } = useApp();
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'SnipeAI',
      text: `Merhaba **${user?.name || 'Yönetici'}**! 🤖 Ben **Snipe-IT Envanter Komutanı**.\n\nDoğal dille komut vererek Snipe-IT üzerindeki tüm zimmetleri yönetebilir, boşa çıkartabilir, çift kullanıcıları temizleyebilir veya toplu e-posta güncellemeleri yapabilirsin.\n\nTüm kritik işlemler için önce **onay kartı** sunarım, sen onaylamadan hiçbir şey değiştirilmez! 🛡️`,
      timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [executingActionId, setExecutingActionId] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(scrollToBottom, 150);
    }
  }, [isOpen, messages]);

  const handleSendMessage = async (customText = null) => {
    const textToSend = (customText || inputVal).trim();
    if (!textToSend || isLoading) return;

    const userMsgId = 'u_' + Date.now();
    const newUserMsg = {
      id: userMsgId,
      sender: 'User',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, newUserMsg]);
    if (!customText) setInputVal('');
    setIsLoading(true);

    try {
      const historyPayload = messages.slice(-8).map(m => ({
        sender: m.sender,
        text: m.text
      }));

      let replyText = null;
      let actionProposal = null;

      // 1. Önce Backend AI Endpoint'ini dene
      try {
        const res = await fetch(`${getApiBase()}/api/snipe-ai/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: textToSend,
            history: historyPayload,
            userContext: { name: user?.name }
          })
        });

        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (res.ok && data.success) {
            replyText = data.reply;
            actionProposal = data.actionProposal;
          }
        }
      } catch (beErr) {
        console.warn('[SnipeIT AI] Backend chat endpoint not reachable, switching to client fallback:', beErr);
      }

      // 2. Eğer backend endpoint'i henüz güncellenmemişse doğrudan tarayıcıdan çalıştır (Fail-safe)
      if (!replyText) {
        const GEMINI_KEY = settings?.gemini_api_key || '';
        let clientContext = '';

        try {
          const [uRes, aRes] = await Promise.all([
            fetch(`${getApiBase()}/api/cached/users`).then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),
            fetch(`${getApiBase()}/api/cached/assets`).then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] }))
          ]);

          const allUsers = uRes.data || [];
          const allAssets = aRes.data || [];

          // Kullanıcı veya cihaz eşleşmesi ara
          const lowerText = textToSend.toLowerCase();
          const matchedUsers = allUsers.filter(u => 
            u.name?.toLowerCase().includes(lowerText) || 
            lowerText.includes(u.name?.toLowerCase().trim()) ||
            u.username?.toLowerCase().includes(lowerText)
          );

          if (matchedUsers.length > 0) {
            clientContext += `\n[BULUNAN KULLANICILAR]:\n`;
            matchedUsers.forEach(u => {
              const uAssets = allAssets.filter(a => String(a.assigned_to_user_id) === String(u.id) || a.assigned_to_user_name === u.name);
              clientContext += `* ${u.name} (Snipe ID: ${u.id}, Kullanıcı Adı: ${u.username}, E-posta: ${u.email || 'Yok'}, Departman: ${u.department_name || 'Yok'})\n`;
              if (uAssets.length > 0) {
                clientContext += `  Zimmetli Cihazlar:\n`;
                uAssets.forEach(a => {
                  clientContext += `  - Tag: ${a.asset_tag} | Model: ${a.model_name || a.name} | Seri: ${a.serial || 'Yok'} | Durum: ${a.status_name} (Asset ID: ${a.id})\n`;
                });
              } else {
                clientContext += `  (Zimmetli cihazı yok)\n`;
              }
            });
          }

          // Konum / Departman / Şirket Taraması
          const locKeywords = ['merkez', 'depo', 'fabrika', 'arge'];
          for (const lk of locKeywords) {
            if (lowerText.includes(lk)) {
              const compUsers = allUsers.filter(u => 
                u.location_name?.toLowerCase().includes(lk) || 
                u.department_name?.toLowerCase().includes(lk) ||
                u.name?.toLowerCase().includes(lk)
              );
              if (compUsers.length > 0) {
                clientContext += `\n[KONUM / DEPARTMAN / ŞİRKET BAZLI GERÇEK KULLANICILAR ("${lk.toUpperCase()}") - Toplam ${compUsers.length} kişi]:\n`;
                compUsers.slice(0, 50).forEach(u => {
                  clientContext += `* ID: ${u.id} | İsim: ${u.name} | Kullanıcı Adı: ${u.username} | E-posta: ${u.email || 'BOŞ'} | Departman: ${u.department_name || 'Yok'} | Lokasyon: ${u.location_name || 'Yok'}\n`;
                });
              }
            }
          }

          // Tekrarlayan kullanıcı kontrolü
          if (lowerText.includes('tekrar') || lowerText.includes('çift') || lowerText.includes('aynı isim')) {
            const nameCounts = {};
            allUsers.forEach(u => {
              const n = u.name?.trim().toLowerCase();
              if (n) nameCounts[n] = (nameCounts[n] || 0) + 1;
            });
            const dupNames = Object.entries(nameCounts).filter(([_, c]) => c > 1);
            if (dupNames.length > 0) {
              clientContext += `\n[TEKRARLAYAN MÜKERRER KULLANICILAR]:\n`;
              dupNames.slice(0, 8).forEach(([nm, c]) => {
                const accounts = allUsers.filter(u => u.name?.trim().toLowerCase() === nm);
                clientContext += `* "${accounts[0]?.name}" (${c} adet hesap):\n`;
                accounts.forEach(a => {
                  const devCount = allAssets.filter(as => String(as.assigned_to_user_id) === String(a.id)).length;
                  clientContext += `  - ID: ${a.id} | Kullanıcı Adı: ${a.username} | E-posta: ${a.email || 'Yok'} | Cihaz Sayısı: ${devCount}\n`;
                });
              });
            }
          }

          // Cihaz tag araması
          const stopWords = new Set([
            'aga', 'kanka', 'abi', 'dostum', 'hocam', 'reis', 'var', 'yok', 'mı', 'mi', 'mu', 'mü',
            'ile', 'için', 'olan', 'tüm', 'sekme', 'kullanıcı', 'kullanıcılar', 'kullanıcılarda',
            'şekilde', 'düzenle', 'yap', 'et', 'büyük', 'küçük', 'harf', 'harfleri', 'harfle',
            'yazılı', 'gibi', 'bana', 'bunu', 'şunu', 'senle', 'sen', 'ben', 'veya', 'ama', 'fakat',
            'ancak', 'sadece', 'bütün', 'herkes', 'adları', 'soyadı', 'soyadları', 'isim', 'isimleri',
            'kontrol', 'kontrolü', 'turkce', 'türkçe', 'karakter', 'karakterler', 'karakterleri',
            'isminde', 'soyisminde', 'kimsenin', 'olmaması', 'olmasın', 'lazım', 'gerek', 'lütfen',
            'şunları', 'bunları', 'olanları', 'eder', 'misin', 'misiniz', 'bak', 'temizle', 'çevir', 'dönüştür'
          ]);
          const words = textToSend.replace(/[^\w\sğüşıöçĞÜŞİÖÇ]/gi, ' ').split(/\s+/).filter(w => w.length >= 3 && !stopWords.has(w.toLowerCase()));
          for (const w of words) {
            const mAssets = allAssets.filter(a => 
              a.asset_tag?.toLowerCase().includes(w.toLowerCase()) || 
              a.serial?.toLowerCase().includes(w.toLowerCase()) ||
              a.name?.toLowerCase().includes(w.toLowerCase())
            );
            if (mAssets.length > 0) {
              clientContext += `\n[BULUNAN CİHAZLAR ("${w}")]:\n`;
              mAssets.forEach(a => {
                clientContext += `* Tag: ${a.asset_tag} (Asset ID: ${a.id}) | Model: ${a.model_name || a.name} | Zimmetli: ${a.assigned_to_user_name || 'Boşta / Depoda'} (User ID: ${a.assigned_to_user_id || 'Yok'})\n`;
              });
            }
          }

          // Genel Kullanıcı / İsim Formatlama Talebi
          if (lowerText.includes('tüm') || lowerText.includes('bütün') || lowerText.includes('isim') || lowerText.includes('ad soyad') || lowerText.includes('format') || lowerText.includes('baş harf') || lowerText.includes('kullanıcı')) {
            clientContext += `\n[SİSTEMDE KAYITLI TÜM KULLANICILAR (Toplam ${allUsers.length} kayıtlı personel)]:\n`;
            allUsers.slice(0, 20).forEach(u => {
              clientContext += `* ID: ${u.id} | İsim: ${u.name} | Kullanıcı Adı: ${u.username} | E-posta: ${u.email || 'Yok'}\n`;
            });
          }

          // Türkçe Karakter Kontrol ve Temizleme Talebi
          if (lowerText.includes('türkçe') || lowerText.includes('turkce') || lowerText.includes('karakter') || lowerText.includes('ascii') || lowerText.includes('ingilizce') || lowerText.includes('temizle') || lowerText.includes('kontrol')) {
            const trMap = { 'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G', 'ı': 'i', 'İ': 'I', 'ö': 'o', 'Ö': 'O', 'ş': 's', 'Ş': 'S', 'ü': 'u', 'Ü': 'U' };
            const withTrChars = allUsers.filter(u => u.name && /[çÇğĞıİöÖşŞüÜ]/.test(u.name));
            clientContext += `\n[TÜRKÇE KARAKTER İÇEREN KULLANICILAR (Toplam ${withTrChars.length} kişi)]:\n`;
            if (withTrChars.length > 0) {
              withTrChars.slice(0, 35).forEach(u => {
                const asciiName = u.name.replace(/[çÇğĞıİöÖşŞüÜ]/g, m => trMap[m] || m);
                clientContext += `* ID: ${u.id} | Mevcut: ${u.name} -> ASCII: ${asciiName} | Kullanıcı Adı: ${u.username}\n`;
              });
            } else {
              clientContext += `* Sistemdeki hiçbir kullanıcının adında/soyadında Türkçe karakter (ç, ğ, ı, ö, ş, ü, İ) kalmamıştır. Hepsi temiz ASCII/İngilizce karakterdir.\n`;
            }
          }
        } catch (cErr) {
          console.warn('[SnipeIT AI Client Data Error]:', cErr);
        }

        const SYSTEM_PROMPT = `Sen "Snipe-IT Envanter Komutanı" yapay zeka asistanısın. Görevin şirketin Snipe-IT envanterini yönetmek, zimmet atamak, zimmetten düşürmek, kullanıcıları düzenlemek, çift hesapları temizlemek ve toplu güncellemeler yapmaktır.

ÖNEMLİ KURALLAR:
1. KESİNLİKLE hayali veya uydurma isimler KULLANMA! Sadece sana sağlanan GERÇEK veritabanı kayıtlarındaki ID ve isimleri kullan!
2. Bilgi verirken net, Türkçe, profesyonel ve çözüm odaklı konuş.
3. KULLANICI BİR FORMATLAMA/DÜZENLEME TALEP ETTİĞİNDE (tek bir kişi veya tüm kullanıcılar için) ASLA "gerek yok", "zaten uyumlu", "zaten böyle kayıtlı" DİYEREK REDDETME VEYA TARTIŞMA; HER ZAMAN KULLANICININ İSTEDİĞİ EYLEMİ HAZIRLA VE ONAY KARTINI SUN!
4. KULLANICI KURALLARI:
   - Tek bir kullanıcının soyismini/adını değiştirmek istediğinde (Örn: Ahmet Yılmaz'ın soyadını büyük harf yap): 'UPDATE_USER' eylemini 'first_name': 'Ahmet', 'last_name': 'YILMAZ' parametreleriyle öner!
   - Tüm kullanıcıların soyisimlerini veya adlarını "sadece baş harfi büyük, geri kalanı küçük" (Title Case, Örn: Ahmet Yılmaz) yapmak istediğinde: 'FORMAT_ALL_USER_NAMES' eylemini öner!
   - Tüm kullanıcıların soyisimlerini "tamamen büyük harf" (Ad SOYAD, Örn: Ahmet YILMAZ) yapmak istediğinde: 'UPPERCASE_SURNAMES' eylemini öner!
   - Kullanıcı Türkçe karakterleri temizlemek (ASCII İngilizce, Örn: Asli Celebi) istediğinde: 'REMOVE_TURKISH_CHARS' eylemini öner!
5. EĞER BİR DEĞİŞİKLİK VEYA EYLEM GEREKİYORSA, cevabının SONUNA mutlaka aşağıdaki JSON formatında tek satırlık [ACTION_PROPOSAL:...] bloğu ekle.

EYLEM JSON FORMATLARI:
- Tüm Kullanıcıların İsim ve Soyisimlerini Formatlama (Title Case: Ad Soyad):
[ACTION_PROPOSAL:{"type":"FORMAT_ALL_USER_NAMES","title":"Tüm Kullanıcı İsim ve Soyisimlerini Formatla (Title Case)","desc":"Sistemdeki tüm kayıtlı kullanıcıların ad ve soyadları 'İlk Harf Büyük, Diğerleri Küçük' (Örn: Ahmet Karagoz) formatına dönüştürülecek."}]

- Soyisimleri Tamamen Büyük Harf Yapma (Ad SOYAD):
[ACTION_PROPOSAL:{"type":"UPPERCASE_SURNAMES","title":"Tüm Soyisimleri Büyük Harf Yap (Ad SOYAD)","desc":"Sistemdeki tüm kayıtlı kullanıcıların soyisimleri tamamen BÜYÜK harf (Örn: Ahmet KARAGOZ) formatına dönüştürülecek."}]

- Tüm Türkçe Karakterleri Temizleme (ASCII'ye Çevirme):
[ACTION_PROPOSAL:{"type":"REMOVE_TURKISH_CHARS","title":"Tüm Türkçe Karakterleri Temizle (ASCII)","desc":"İsim veya soyisimlerinde Türkçe karakter bulunan kullanıcıların adları ASCII İngilizce harflere dönüştürülecek."}]

- Cihaz Zimmetini Düşürme (Check-in / Boşa Çıkartma):
[ACTION_PROPOSAL:{"type":"CHECKIN_ASSET","assetId":123,"assetTag":"G10NTB165A","assetName":"Lenovo ThinkPad","currentUserName":"Ahmet YILMAZ","title":"Zimmetten Düşürme (Boşa Çıkart)","desc":"G10NTB165A nolu cihaz Ahmet YILMAZ üzerinden alınıp boşa çıkartılacak."}]

- Cihaza Kullanıcı Zimmetleme (Check-out):
[ACTION_PROPOSAL:{"type":"CHECKOUT_ASSET","assetId":123,"assetTag":"G10NTB165A","assetName":"Lenovo ThinkPad","targetUserId":2,"targetUserName":"İsmail KARA","title":"Cihazı Zimmetle","desc":"G10NTB165A nolu cihaz İsmail KARA personeline zimmetlenecek."}]

- Tek Bir Kullanıcının İsim, Soyisim veya Bilgisini Güncelleme (UPDATE_USER):
[ACTION_PROPOSAL:{"type":"UPDATE_USER","userId":1,"userName":"Ahmet YILMAZ","first_name":"Ahmet","last_name":"Yilmaz","title":"Kullanıcı Bilgisini Güncelle","desc":"Ahmet YILMAZ (ID: 1) kullanıcısının adı 'Esat', soyadı 'Erhan' olarak güncellenecek."}]

ÖNEMLİ: Kullanıcı belirli bir kişinin adını veya soyadını değiştirmek, küçük harf yapmak, büyük harf yapmak veya düzeltmek istediğinde (Örn: "Ahmet YILMAZ'ın soy adını küçük harflerle yaz", "İsmail'in adını düzenle") KESİNLİKLE 'UPDATE_USER' eylemini kullan! ASLA "şablon bulunmuyor", "yapamam" veya "zaten kayıtlı" diyerek reddetme!

- Kullanıcı Silme:
[ACTION_PROPOSAL:{"type":"DELETE_USER","userId":12,"userName":"Ahmet YILMAZ","title":"Kullanıcıyı Sil","desc":"Zimmeti bulunmayan 'Ahmet YILMAZ' (ID: 12) kullanıcısı Snipe-IT sisteminden silinecek."}]

- Toplu E-Posta veya Bilgi Güncelleme (BULK_UPDATE_USERS):
[ACTION_PROPOSAL:{"type":"BULK_UPDATE_USERS","title":"Toplu E-Posta Güncelleme (B41)","desc":"Konumu B41 olan e-postası boş kullanıcıların adresleri güncellenecek.","location":"B41","domain":"@example.com","items":[{"userId":11,"userName":"Tugba ILBAY","email":"tugba.ilbay@example.com"}]}]

SADECE aşağıdaki veritabanı bilgilerini kullan:
${clientContext}`;

        const candidateModels = [
          'gemini-3.5-flash-lite',
          'gemini-3.1-flash-lite-preview',
          'gemini-3.5-flash',
          'gemini-2.5-flash'
        ];

        const historyPayloadGemini = messages.slice(-6).map(h => ({
          role: h.sender === 'SnipeAI' ? 'model' : 'user',
          parts: [{ text: h.text || '' }]
        }));

        const contents = [...historyPayloadGemini, { role: 'user', parts: [{ text: textToSend }] }];

        for (const mName of candidateModels) {
          try {
            const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${mName}:generateContent?key=${GEMINI_KEY}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
                contents,
                generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
              })
            });

            if (gRes.ok) {
              const gData = await gRes.json();
              const txt = gData.candidates?.[0]?.content?.parts?.[0]?.text;
              if (txt) {
                replyText = txt;
                break;
              }
            }
          } catch (mErr) {
            console.warn(`[SnipeIT AI Fallback] Model ${mName} failed:`, mErr.message);
          }
        }

        if (replyText) {
          const startIdx = replyText.indexOf('[ACTION_PROPOSAL:');
          if (startIdx !== -1) {
            const jsonStart = startIdx + 17;
            const endIdx = replyText.lastIndexOf(']');
            if (endIdx > jsonStart) {
              const jsonStr = replyText.substring(jsonStart, endIdx).trim();
              try {
                actionProposal = JSON.parse(jsonStr);
              } catch (pe) {
                console.warn('[SnipeIT AI Action Parse Error]', pe);
              }
            }
            replyText = replyText.substring(0, startIdx).trim();
          }
          replyText = replyText.replace(/\[ACTION_PROPOSAL:[\s\S]*/g, '').trim();
        }
      }

      if (!replyText) {
        throw new Error('Snipe-IT AI şu anda yanıt üretemedi. Lütfen internet bağlantınızı kontrol edin.');
      }

      const aiMsg = {
        id: 'ai_' + Date.now(),
        sender: 'SnipeAI',
        text: replyText,
        actionProposal: actionProposal ? { ...actionProposal, status: 'pending', id: 'act_' + Date.now() } : null,
        timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, aiMsg]);

    } catch (err) {
      console.error('[SnipeIT AI] Message error:', err);
      setMessages(prev => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          sender: 'SnipeAI',
          text: `⚠️ Bir hata oluştu: ${err.message}`,
          timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecuteAction = async (msgId, action) => {
    setExecutingActionId(action.id);
    try {
      let resultMsg = null;

      // 1. Önce Backend AI Execute Endpoint'ini dene
      try {
        const res = await fetch(`${getApiBase()}/api/snipe-ai/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action })
        });

        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (res.ok && data.success) {
            resultMsg = data.message;
          } else if (data.error) {
            throw new Error(data.error);
          }
        }
      } catch (beErr) {
        console.warn('[SnipeIT AI] Backend execute endpoint failed, switching to direct client fallback:', beErr);
      }

      // 2. Eğer backend henüz güncellenmemişse doğrudan Snipe-IT API'sine istek at (Fail-safe)
      if (!resultMsg) {
        const confRes = await fetch(`${getApiBase()}/api/snipe-config`).then(r => r.json()).catch(() => ({}));
        const snipeUrl = confRes.config?.snipe_url || confRes.config?.snipeit_url || 'https://snipe.example.com';
        const snipeToken = confRes.config?.snipe_token || confRes.config?.snipeit_api_key;

        if (!snipeToken) {
          throw new Error('Snipe-IT API bağlantısı ve token bilgisi alınamadı.');
        }

        const headers = {
          'Authorization': `Bearer ${snipeToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        };

        let assetId = action.assetId;
        let targetUserId = action.targetUserId;
        const targetUserName = action.targetUserName;

        if (!assetId && action.assetTag) {
          const aRes = await fetch(`${getApiBase()}/api/cached/assets`).then(r => r.json()).catch(() => ({ data: [] }));
          const foundA = (aRes.data || []).find(a => a.asset_tag?.toLowerCase() === action.assetTag?.toLowerCase());
          if (foundA) assetId = foundA.id;
        }

        if (targetUserName) {
          const uRes = await fetch(`${getApiBase()}/api/cached/users`).then(r => r.json()).catch(() => ({ data: [] }));
          const cleanName = targetUserName.toLowerCase().trim();
          const foundU = (uRes.data || []).find(u => 
            u.name?.toLowerCase().trim().includes(cleanName) || 
            cleanName.includes(u.name?.toLowerCase().trim()) || 
            u.username?.toLowerCase() === cleanName
          );
          if (foundU) targetUserId = foundU.id;
        }

        if (action.type === 'CHECKIN_ASSET') {
          if (!assetId) throw new Error('Cihaz ID bulunamadı.');
          const cRes = await fetch(`${snipeUrl}/api/v1/hardware/${assetId}/checkin`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ note: action.note || 'ServiceTracker AI tarafından boşa çıkartıldı', status_id: 9 })
          });
          const cData = await cRes.json();
          if (cData.status === 'error') throw new Error(cData.messages || 'Boşa çıkartılamadı');
          resultMsg = `✅ ${action.assetTag || 'Cihaz'} başarıyla boşa çıkartıldı ve depoya alındı!`;
        } else if (action.type === 'CHECKOUT_ASSET') {
          if (!assetId) throw new Error('Cihaz ID bulunamadı.');
          if (!targetUserId) throw new Error(`Hedef kullanıcı (${targetUserName || 'Tanımsız'}) ID bulunamadı.`);

          // Önce mevcut zimmetten düşür ve durumu hazır yap
          try {
            await fetch(`${snipeUrl}/api/v1/hardware/${assetId}/checkin`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ note: 'Zimmet değişimi için boşa çıkartıldı', status_id: 9 })
            });
          } catch (e) {}

          const cRes = await fetch(`${snipeUrl}/api/v1/hardware/${assetId}/checkout`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              assigned_user: targetUserId,
              checkout_to_type: 'user',
              note: action.note || `${targetUserName} adına zimmetlendi`
            })
          });
          const cData = await cRes.json();
          if (cData.status === 'error') throw new Error(cData.messages || 'Zimmetleme yapılamadı');
          resultMsg = `✅ ${action.assetTag || 'Cihaz'} başarıyla ${targetUserName} adına zimmetlendi!`;
        } else if (action.type === 'DELETE_USER') {
          const userId = action.userId || targetUserId;
          if (!userId) throw new Error('Silinecek kullanıcı ID bulunamadı.');
          const dRes = await fetch(`${snipeUrl}/api/v1/users/${userId}`, {
            method: 'DELETE',
            headers
          });
          const dData = await dRes.json();
          if (dData.status === 'error') throw new Error(dData.messages || 'Kullanıcı silinemedi');
          resultMsg = `✅ ${action.userName || 'Kullanıcı'} başarıyla silindi!`;
        } else if (action.type === 'UPDATE_USER' || action.type === 'UPDATE_USER_NAME') {
          let userId = action.userId || targetUserId;
          let userName = action.userName || targetUserName;
          if (!userId && userName) {
            const uRes = await fetch(`${getApiBase()}/api/cached/users`).then(r => r.json()).catch(() => ({ data: [] }));
            const found = (uRes.data || []).find(u => u.name?.toLowerCase().includes(userName.toLowerCase()));
            if (found) userId = found.id;
          }
          if (!userId) throw new Error('Kullanıcı ID bulunamadı.');

          const patchBody = {};
          if (action.email) patchBody.email = action.email;
          if (action.first_name) patchBody.first_name = action.first_name;
          if (action.last_name) patchBody.last_name = action.last_name;
          if (action.newName) {
            const words = action.newName.split(' ');
            patchBody.first_name = words.slice(0, -1).join(' ') || words[0];
            patchBody.last_name = words.length > 1 ? words[words.length - 1] : '';
          }
          if (action.updates && typeof action.updates === 'object') {
            Object.assign(patchBody, action.updates);
          }

          const uRes = await fetch(`${snipeUrl}/api/v1/users/${userId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(patchBody)
          });
          const uData = await uRes.json();
          if (uData.status === 'error') throw new Error(uData.messages || 'Kullanıcı güncellenemedi');
          resultMsg = `✅ ${userName || 'Kullanıcı'} bilgileri Snipe-IT üzerinde başarıyla güncellendi!`;
        } else if (action.type === 'UPPERCASE_SURNAMES' || action.type === 'FORMAT_UPPERCASE_SURNAMES' || action.formatType === 'uppercase_surname') {
          function removeTr(str) {
            if (!str) return '';
            const map = { 'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G', 'ı': 'i', 'İ': 'I', 'ö': 'o', 'Ö': 'O', 'ş': 's', 'Ş': 'S', 'ü': 'u', 'Ü': 'U' };
            return str.replace(/[çÇğĞıİöÖşŞüÜ]/g, m => map[m] || m);
          }
          function formatNameUppercaseSurname(str) {
            if (!str) return '';
            const clean = removeTr(str);
            const words = clean.split(/\s+/).filter(Boolean);
            if (words.length === 0) return '';
            if (words.length === 1) return words[0].toUpperCase();
            const firstNames = words.slice(0, -1).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            const surname = words[words.length - 1].toUpperCase();
            return firstNames + ' ' + surname;
          }
          const uRes = await fetch(`${getApiBase()}/api/cached/users`).then(r => r.json()).catch(() => ({ data: [] }));
          const allUsers = uRes.data || [];
          let count = 0;
          for (const u of allUsers) {
            const formattedName = formatNameUppercaseSurname(u.name);
            if (formattedName && formattedName !== u.name) {
              try {
                const words = formattedName.split(' ');
                const firstName = words.slice(0, -1).join(' ') || words[0];
                const lastName = words.length > 1 ? words[words.length - 1] : '';
                await fetch(`${snipeUrl}/api/v1/users/${u.id}`, {
                  method: 'PATCH',
                  headers,
                  body: JSON.stringify({ first_name: firstName, last_name: lastName })
                });
                count++;
              } catch (ie) {}
            }
          }
          resultMsg = `✅ Toplam ${count} kullanıcının soyisimleri başarıyla büyük harfe (Ad SOYAD) dönüştürüldü!`;
        } else if (action.type === 'REMOVE_TURKISH_CHARS') {
          function removeTurkishChars(str) {
            if (!str) return '';
            const map = { 'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G', 'ı': 'i', 'İ': 'I', 'ö': 'o', 'Ö': 'O', 'ş': 's', 'Ş': 'S', 'ü': 'u', 'Ü': 'U' };
            return str.replace(/[çÇğĞıİöÖşŞüÜ]/g, m => map[m] || m);
          }
          const uRes = await fetch(`${getApiBase()}/api/cached/users`).then(r => r.json()).catch(() => ({ data: [] }));
          const allUsers = uRes.data || [];
          let count = 0;
          for (const u of allUsers) {
            const formattedName = removeTurkishChars(u.name);
            if (formattedName && formattedName !== u.name) {
              try {
                const words = formattedName.split(' ');
                const firstName = words.slice(0, -1).join(' ') || words[0];
                const lastName = words.length > 1 ? words[words.length - 1] : '';
                await fetch(`${snipeUrl}/api/v1/users/${u.id}`, {
                  method: 'PATCH',
                  headers,
                  body: JSON.stringify({ first_name: firstName, last_name: lastName })
                });
                count++;
              } catch (ie) {}
            }
          }
          resultMsg = `✅ Toplam ${count} kullanıcının Türkçe karakterleri temizlendi!`;
        } else if (action.type === 'FORMAT_ALL_USER_NAMES' || action.type === 'BULK_FORMAT_NAMES' || action.formatType === 'title_case' || action.title?.toLowerCase().includes('isim') || action.title?.toLowerCase().includes('ad')) {
          function toTitleCaseTr(str) {
            if (!str) return '';
            return str.toLocaleLowerCase('tr-TR').split(/\s+/).map(w => w ? w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1) : '').join(' ');
          }

          const uRes = await fetch(`${getApiBase()}/api/cached/users`).then(r => r.json()).catch(() => ({ data: [] }));
          const allUsers = uRes.data || [];
          let count = 0;

          for (const u of allUsers) {
            const formattedName = toTitleCaseTr(u.name);
            if (formattedName && formattedName !== u.name) {
              try {
                const words = formattedName.split(' ');
                const firstName = words.slice(0, -1).join(' ') || words[0];
                const lastName = words.length > 1 ? words[words.length - 1] : '';

                await fetch(`${snipeUrl}/api/v1/users/${u.id}`, {
                  method: 'PATCH',
                  headers,
                  body: JSON.stringify({
                    first_name: firstName,
                    last_name: lastName
                  })
                });
                count++;
              } catch (ie) {}
            }
          }
          resultMsg = `✅ Toplam ${count} kullanıcının ad ve soyadları başarıyla 'İlk Harf Büyük' formatına dönüştürüldü!`;
        } else if (action.type === 'BULK_UPDATE_USERS') {
          let items = action.items || [];
          if (action.location) {
            const uRes = await fetch(`${getApiBase()}/api/cached/users`).then(r => r.json()).catch(() => ({ data: [] }));
            const locUsers = (uRes.data || []).filter(u => 
              (u.location_name?.toLowerCase().includes(action.location.toLowerCase()) || u.department_name?.toLowerCase().includes(action.location.toLowerCase())) &&
              (!u.email || u.email.trim() === '')
            );
            if (locUsers.length > 0 && (items.length === 0 || locUsers.length > items.length)) {
              items = locUsers.map(u => {
                const cleanUser = (u.username || u.name.toLowerCase().replace(/[^a-zA-Z0-9]/g, '.')).replace(/\.+/g, '.');
                return {
                  userId: u.id,
                  userName: u.name,
                  email: `${cleanUser}${action.domain || '@example.com'}`
                };
              });
            }
          }
          let count = 0;
          for (const item of items) {
            try {
              const payload = {};
              const newEmail = item.newVal || item.email || item.newEmail;
              const newName = item.newName || item.name;

              if (newEmail) payload.email = newEmail;
              if (newName) {
                const words = newName.split(' ');
                payload.first_name = words.slice(0, -1).join(' ') || words[0];
                payload.last_name = words.length > 1 ? words[words.length - 1] : '';
              }

              if (Object.keys(payload).length > 0 && item.userId) {
                await fetch(`${snipeUrl}/api/v1/users/${item.userId}`, {
                  method: 'PATCH',
                  headers,
                  body: JSON.stringify(payload)
                });
                count++;
              }
            } catch (ie) {}
          }
          resultMsg = `✅ Toplam ${count} kullanıcının bilgileri başarıyla güncellendi!`;
        } else {
          throw new Error('İşlem gerçekleştirilemedi: Bilinmeyen eylem türü.');
        }
      }

      // Action card durumunu güncelle
      setMessages(prev => prev.map(m => {
        if (m.id === msgId && m.actionProposal) {
          return {
            ...m,
            actionProposal: {
              ...m.actionProposal,
              status: 'executed',
              resultMessage: resultMsg
            }
          };
        }
        return m;
      }));

      showNotification(resultMsg || 'İşlem başarıyla tamamlandı!', 'success');

    } catch (err) {
      console.error('[SnipeIT AI] Action execution error:', err);
      showNotification(`İşlem başarısız: ${err.message}`, 'error');
      setMessages(prev => prev.map(m => {
        if (m.id === msgId && m.actionProposal) {
          return {
            ...m,
            actionProposal: {
              ...m.actionProposal,
              status: 'failed',
              errorMessage: err.message
            }
          };
        }
        return m;
      }));
    } finally {
      setExecutingActionId(null);
    }
  };

  const handleCancelAction = (msgId) => {
    setMessages(prev => prev.map(m => {
      if (m.id === msgId && m.actionProposal) {
        return {
          ...m,
          actionProposal: {
            ...m.actionProposal,
            status: 'cancelled'
          }
        };
      }
      return m;
    }));
    showNotification('Eylem iptal edildi.', 'info');
  };

  if (!isOpen) return null;

  return (
    <div className="snipe-ai-overlay">
      <div className="snipe-ai-drawer animate-slide-left">
        {/* Header */}
        <div className="snipe-ai-header">
          <div className="snipe-ai-title-group">
            <div className="snipe-ai-icon-badge">🤖</div>
            <div>
              <div className="snipe-ai-title">Snipe-IT AI Komutanı</div>
              <div className="snipe-ai-subtitle">Canlı Envanter, Zimmet & Kullanıcı Ajanı</div>
            </div>
          </div>
          <div className="snipe-ai-header-actions">
            <button
              className="snipe-ai-btn-icon"
              title="Sohbeti Temizle"
              onClick={() => setMessages([messages[0]])}
            >
              🗑️
            </button>
            <button
              className="snipe-ai-btn-icon"
              title="Kapat"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Quick Action Chips */}
        <div 
          className="snipe-ai-quick-chips"
          onWheel={(e) => {
            if (e.deltaY !== 0) {
              e.currentTarget.scrollLeft += e.deltaY;
            }
          }}
        >
          <button onClick={() => handleSendMessage('Tekrarlayan kullanıcı var mı? Kontrol et.')}>
            👥 Çift Kullanıcıları Tara
          </button>
          <button onClick={() => handleSendMessage('Ahmet Yılmaz adına zimmetli cihazları listele.')}>
            💻 Ahmet'in Zimmetleri
          </button>
          <button onClick={() => handleSendMessage('Depoda boşta duran bilgisayarları listele.')}>
            📦 Boştaki Cihazlar
          </button>
          <button onClick={() => handleSendMessage('B11 şirketindeki kullanıcıların e-posta uzantılarını listele.')}>
            🏢 B11 Şirket Mailleri
          </button>
        </div>

        {/* Messages Body */}
        <div className="snipe-ai-body">
          {messages.map(msg => (
            <div key={msg.id} className={`snipe-msg-row ${msg.sender === 'User' ? 'snipe-user-row' : 'snipe-ai-row'}`}>
              <div className="snipe-msg-bubble">
                <div className="snipe-msg-author">
                  {msg.sender === 'User' ? (user?.name || 'Sen') : '🤖 Snipe-IT AI'}
                  <span className="snipe-msg-time">{msg.timestamp}</span>
                </div>
                <div className="snipe-msg-text" dangerouslySetInnerHTML={{
                  __html: (msg.text || '')
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                    .replace(/\n/g, '<br/>')
                }} />

                {/* Action Proposal Card */}
                {msg.actionProposal && (
                  <div className={`snipe-action-card ${msg.actionProposal.status}`}>
                    <div className="action-card-header">
                      <span className="action-card-icon">
                        {msg.actionProposal.status === 'executed' ? '✅' :
                         msg.actionProposal.status === 'cancelled' ? '🚫' :
                         msg.actionProposal.status === 'failed' ? '❌' : '⚡'}
                      </span>
                      <div className="action-card-title-box">
                        <div className="action-card-title">{msg.actionProposal.title || 'Snipe-IT Eylem Onayı'}</div>
                        <div className="action-card-desc">{msg.actionProposal.desc}</div>
                      </div>
                    </div>

                    {msg.actionProposal.status === 'pending' && (
                      <div className="action-card-footer">
                        <button
                          className="btn-action-confirm"
                          disabled={executingActionId === msg.actionProposal.id}
                          onClick={() => handleExecuteAction(msg.id, msg.actionProposal)}
                        >
                          {executingActionId === msg.actionProposal.id ? '⏳ Snipe-IT Güncelleniyor...' : '✅ Onayla ve Uygula'}
                        </button>
                        <button
                          className="btn-action-cancel"
                          disabled={executingActionId === msg.actionProposal.id}
                          onClick={() => handleCancelAction(msg.id)}
                        >
                          ❌ İptal
                        </button>
                      </div>
                    )}

                    {msg.actionProposal.status === 'executed' && (
                      <div className="action-card-result success">
                        {msg.actionProposal.resultMessage || 'İşlem Snipe-IT üzerinde başarıyla uygulandı.'}
                      </div>
                    )}

                    {msg.actionProposal.status === 'cancelled' && (
                      <div className="action-card-result cancelled">
                        İşlem kullanıcı tarafından iptal edildi. Snipe-IT üzerinde değişiklik yapılmadı.
                      </div>
                    )}

                    {msg.actionProposal.status === 'failed' && (
                      <div className="action-card-result error">
                        ⚠️ Hata: {msg.actionProposal.errorMessage}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="snipe-msg-row snipe-ai-row">
              <div className="snipe-msg-bubble snipe-loading-bubble">
                <span className="snipe-dot-flashing"></span>
                <span>Snipe-IT veritabanı taranıyor ve eylem planı hazırlanıyor...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="snipe-ai-input-bar">
          <textarea
            className="snipe-ai-textarea"
            placeholder="Örn: 'Ahmet'e zimmetli kasayı boşa çıkart' veya 'Çift kayıtlı kullanıcıları sil'..."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            rows={2}
          />
          <button
            className="snipe-ai-send-btn"
            disabled={!inputVal.trim() || isLoading}
            onClick={() => handleSendMessage()}
          >
            ➤
          </button>
        </div>
      </div>

      <style>{`
        .snipe-ai-overlay {
          position: fixed;
          inset: 0;
          background: rgba(3, 7, 18, 0.65);
          backdrop-filter: blur(8px);
          z-index: 99990;
          display: flex;
          justify-content: flex-end;
          animation: fadeIn 0.25s ease;
        }

        .snipe-ai-drawer {
          width: min(560px, 95vw);
          height: 100vh;
          background: rgba(13, 17, 38, 0.95);
          backdrop-filter: blur(24px);
          border-left: 1px solid rgba(168, 85, 247, 0.35);
          box-shadow: -15px 0 50px rgba(168, 85, 247, 0.2);
          display: flex;
          flex-direction: column;
        }

        .snipe-ai-header {
          padding: 16px 20px;
          border-bottom: 1px solid rgba(168, 85, 247, 0.25);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(10, 14, 30, 0.9);
        }

        .snipe-ai-title-group {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .snipe-ai-icon-badge {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: linear-gradient(135deg, #a855f7, #6366f1);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          box-shadow: 0 0 15px rgba(168, 85, 247, 0.5);
        }

        .snipe-ai-title {
          font-size: 17px;
          font-weight: 700;
          color: #f3e8ff;
          letter-spacing: 0.3px;
        }

        .snipe-ai-subtitle {
          font-size: 12px;
          color: #c084fc;
        }

        .snipe-ai-header-actions {
          display: flex;
          gap: 8px;
        }

        .snipe-ai-btn-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid rgba(168, 85, 247, 0.3);
          background: rgba(255, 255, 255, 0.05);
          color: #e9d5ff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .snipe-ai-btn-icon:hover {
          background: rgba(168, 85, 247, 0.25);
          border-color: #a855f7;
          transform: scale(1.05);
        }

        .snipe-ai-quick-chips {
          padding: 10px 16px;
          background: rgba(15, 23, 48, 0.8);
          border-bottom: 1px solid rgba(168, 85, 247, 0.15);
          display: flex;
          gap: 8px;
          overflow-x: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .snipe-ai-quick-chips::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }

        .snipe-ai-quick-chips button {
          white-space: nowrap;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          background: rgba(168, 85, 247, 0.12);
          border: 1px solid rgba(168, 85, 247, 0.3);
          color: #e9d5ff;
          cursor: pointer;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .snipe-ai-quick-chips button:hover {
          background: rgba(168, 85, 247, 0.3);
          border-color: #c084fc;
          color: #ffffff;
          transform: translateY(-1px);
        }

        .snipe-ai-body {
          flex: 1;
          padding: 16px 20px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
          scrollbar-width: thin;
          scrollbar-color: rgba(168, 85, 247, 0.4) rgba(15, 23, 48, 0.5);
        }

        .snipe-ai-body::-webkit-scrollbar {
          width: 6px;
        }

        .snipe-ai-body::-webkit-scrollbar-track {
          background: rgba(15, 23, 48, 0.5);
        }

        .snipe-ai-body::-webkit-scrollbar-thumb {
          background: rgba(168, 85, 247, 0.4);
          border-radius: 3px;
        }

        .snipe-ai-body::-webkit-scrollbar-thumb:hover {
          background: rgba(168, 85, 247, 0.7);
        }

        .snipe-msg-row {
          display: flex;
          width: 100%;
        }

        .snipe-user-row {
          justify-content: flex-end;
        }

        .snipe-ai-row {
          justify-content: flex-start;
        }

        .snipe-msg-bubble {
          max-width: 88%;
          padding: 12px 16px;
          border-radius: 16px;
          font-size: 13.5px;
          line-height: 1.55;
          position: relative;
        }

        .snipe-user-row .snipe-msg-bubble {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: #ffffff;
          border-bottom-right-radius: 4px;
          box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
        }

        .snipe-ai-row .snipe-msg-bubble {
          background: rgba(23, 29, 60, 0.9);
          border: 1px solid rgba(168, 85, 247, 0.25);
          color: #f1f5f9;
          border-bottom-left-radius: 4px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .snipe-msg-author {
          font-size: 11px;
          font-weight: 700;
          margin-bottom: 6px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          color: #c084fc;
        }

        .snipe-user-row .snipe-msg-author {
          color: #e0e7ff;
        }

        .snipe-msg-time {
          font-size: 10px;
          font-weight: 400;
          opacity: 0.7;
        }

        .snipe-loading-bubble {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #c084fc;
          font-style: italic;
        }

        .snipe-action-card {
          margin-top: 12px;
          padding: 14px;
          border-radius: 12px;
          background: rgba(10, 14, 30, 0.85);
          border: 1px solid rgba(234, 179, 8, 0.4);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
        }

        .snipe-action-card.executed {
          border-color: rgba(34, 197, 94, 0.5);
          background: rgba(6, 44, 24, 0.4);
        }

        .snipe-action-card.cancelled {
          border-color: rgba(148, 163, 184, 0.3);
          opacity: 0.75;
        }

        .snipe-action-card.failed {
          border-color: rgba(239, 68, 68, 0.5);
          background: rgba(69, 10, 10, 0.4);
        }

        .action-card-header {
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }

        .action-card-icon {
          font-size: 20px;
        }

        .action-card-title {
          font-size: 14px;
          font-weight: 700;
          color: #fef08a;
        }

        .snipe-action-card.executed .action-card-title {
          color: #86efac;
        }

        .action-card-desc {
          font-size: 12.5px;
          color: #cbd5e1;
          margin-top: 4px;
        }

        .action-card-footer {
          margin-top: 12px;
          display: flex;
          gap: 10px;
        }

        .btn-action-confirm {
          flex: 1;
          padding: 8px 14px;
          border-radius: 8px;
          border: none;
          background: linear-gradient(135deg, #10b981, #059669);
          color: #ffffff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
          transition: all 0.2s;
        }

        .btn-action-confirm:hover:not(:disabled) {
          background: linear-gradient(135deg, #059669, #047857);
          transform: translateY(-1px);
        }

        .btn-action-cancel {
          padding: 8px 14px;
          border-radius: 8px;
          border: 1px solid rgba(239, 68, 68, 0.4);
          background: rgba(239, 68, 68, 0.1);
          color: #fca5a5;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-action-cancel:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.25);
          border-color: #ef4444;
        }

        .action-card-result {
          margin-top: 10px;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
        }

        .action-card-result.success {
          background: rgba(34, 197, 94, 0.15);
          color: #86efac;
          border: 1px solid rgba(34, 197, 94, 0.3);
        }

        .action-card-result.cancelled {
          background: rgba(148, 163, 184, 0.1);
          color: #94a3b8;
          border: 1px solid rgba(148, 163, 184, 0.2);
        }

        .action-card-result.error {
          background: rgba(239, 68, 68, 0.15);
          color: #fca5a5;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .snipe-ai-input-bar {
          padding: 14px 18px;
          border-top: 1px solid rgba(168, 85, 247, 0.25);
          background: rgba(10, 14, 30, 0.95);
          display: flex;
          gap: 10px;
          align-items: flex-end;
        }

        .snipe-ai-textarea {
          flex: 1;
          background: rgba(23, 29, 60, 0.9);
          border: 1px solid rgba(168, 85, 247, 0.35);
          border-radius: 10px;
          padding: 10px 14px;
          color: #ffffff;
          font-size: 13.5px;
          resize: none;
          outline: none;
          transition: border-color 0.2s;
          font-family: inherit;
        }

        .snipe-ai-textarea:focus {
          border-color: #c084fc;
          box-shadow: 0 0 10px rgba(168, 85, 247, 0.3);
        }

        .snipe-ai-send-btn {
          width: 42px;
          height: 42px;
          border-radius: 10px;
          border: none;
          background: linear-gradient(135deg, #a855f7, #6366f1);
          color: #ffffff;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          box-shadow: 0 4px 15px rgba(168, 85, 247, 0.4);
        }

        .snipe-ai-send-btn:hover:not(:disabled) {
          transform: scale(1.05);
          background: linear-gradient(135deg, #9333ea, #4f46e5);
        }

        .snipe-ai-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideLeft {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }

        .animate-slide-left {
          animation: slideLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
    </div>
  );
}
