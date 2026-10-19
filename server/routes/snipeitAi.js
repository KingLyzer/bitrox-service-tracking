'use strict';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

module.exports = function registerSnipeitAi(app, { pool, snipeitService, helpers }) {
  const { dbError } = helpers;

  // ── 1. Canlı Snipe-IT Veri Sorgulama Yardımcıları ──
  async function searchUsers(searchTerm) {
    const term = `%${searchTerm.trim()}%`;
    const [users] = await pool.query(
      `SELECT id, name, username, email, department_name, location_name 
       FROM cached_users 
       WHERE name LIKE ? OR username LIKE ? OR email LIKE ? 
       LIMIT 15`,
      [term, term, term]
    );

    // Her kullanıcının üstündeki cihazları da çek
    for (const u of users) {
      const [assets] = await pool.query(
        `SELECT id, asset_tag, name, serial, model_name, category_name, location_name, status_name 
         FROM cached_assets 
         WHERE assigned_to_user_id = ? OR assigned_to_user_name = ?`,
        [u.id, u.name]
      );
      u.assigned_assets = assets || [];
      u.assets_count = (assets || []).length;
    }
    return users;
  }

  async function searchAssets(searchTerm) {
    const term = `%${searchTerm.trim()}%`;
    const [assets] = await pool.query(
      `SELECT id, asset_tag, name, serial, model_name, category_name, location_name, status_name, assigned_to_user_id, assigned_to_user_name 
       FROM cached_assets 
       WHERE asset_tag LIKE ? OR serial LIKE ? OR name LIKE ? OR model_name LIKE ? OR assigned_to_user_name LIKE ? 
       LIMIT 15`,
      [term, term, term, term, term]
    );
    return assets;
  }

  async function findDuplicateUsers() {
    const [duplicates] = await pool.query(`
      SELECT LOWER(TRIM(name)) as clean_name, COUNT(*) as count 
      FROM cached_users 
      WHERE name IS NOT NULL AND TRIM(name) != '' 
      GROUP BY LOWER(TRIM(name)) 
      HAVING count > 1 
      ORDER BY count DESC
    `);

    const result = [];
    for (const d of duplicates) {
      const [users] = await pool.query(
        `SELECT id, name, username, email, department_name, location_name 
         FROM cached_users 
         WHERE LOWER(TRIM(name)) = ? 
         ORDER BY id ASC`,
        [d.clean_name]
      );

      for (const u of users) {
        const [assets] = await pool.query(
          `SELECT id, asset_tag, name, model_name FROM cached_assets WHERE assigned_to_user_id = ? OR assigned_to_user_name = ?`,
          [u.id, u.name]
        );
        u.assets_count = (assets || []).length;
      }

      result.push({
        name: users[0]?.name || d.clean_name,
        count: d.count,
        accounts: users
      });
    }
    return result;
  }

  async function getCompanyUsers(companyKeyword) {
    const term = `%${companyKeyword.trim()}%`;
    const [users] = await pool.query(
      `SELECT id, name, username, email, department_name, location_name 
       FROM cached_users 
       WHERE department_name LIKE ? OR location_name LIKE ? OR name LIKE ? 
       ORDER BY name ASC 
       LIMIT 100`,
      [term, term, term]
    );
    return users;
  }

  // ── 2. AI Sohbet & Eylem Analizi Endpoint'i ──
  app.post('/api/snipe-ai/chat', async (req, res) => {
    try {
      const { message, history = [], userContext = {} } = req.body;
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ success: false, error: 'Mesaj içeriği boş olamaz.' });
      }

      // Veritabanı ön-taraması (Kullanıcı, cihaz, konum veya şirket ismi geçiyorsa otomatik tespit et)
      let relevantContext = '';
      const lowerMsg = message.toLowerCase();

      // 1. Çift Kullanıcı Taraması
      if (lowerMsg.includes('tekrar') || lowerMsg.includes('çift') || lowerMsg.includes('aynı isim') || lowerMsg.includes('duplicate')) {
        const dups = await findDuplicateUsers();
        relevantContext += `\n[TESPİT EDİLEN TEKRARLAYAN KULLANICILAR (${dups.length} farklı isim)]:\n`;
        dups.slice(0, 10).forEach(d => {
          relevantContext += `* "${d.name}" ismiyle ${d.count} hesap var:\n`;
          d.accounts.forEach(a => {
            relevantContext += `  - Snipe-IT ID: ${a.id} | Kullanıcı Adı: ${a.username} | E-posta: ${a.email || 'Yok'} | Departman: ${a.department_name || 'Yok'} | Lokasyon: ${a.location_name || 'Yok'} | Üstündeki Cihaz Sayısı: ${a.assets_count || 0}\n`;
          });
        });
      }

      // 2. Konum / Departman / Şirket Taraması
      const locKeywords = ['merkez', 'depo', 'fabrika', 'arge'];
      for (const lk of locKeywords) {
        if (lowerMsg.includes(lk)) {
          const compUsers = await getCompanyUsers(lk);
          if (compUsers.length > 0) {
            relevantContext += `\n[KONUM / DEPARTMAN / ŞİRKET BAZLI GERÇEK KULLANICILAR ("${lk.toUpperCase()}") - Toplam ${compUsers.length} kişi]:\n`;
            compUsers.slice(0, 50).forEach(u => {
              relevantContext += `* ID: ${u.id} | İsim: ${u.name} | Kullanıcı Adı: ${u.username} | E-posta: ${u.email || 'BOŞ'} | Departman: ${u.department_name || 'Yok'} | Lokasyon: ${u.location_name || 'Yok'}\n`;
            });
          }
        }
      }

      // 3. Genel Arama (kişi adı veya cihaz tag'i geçiyorsa)
      const stopWords = new Set([
        'aga', 'kanka', 'abi', 'dostum', 'hocam', 'reis', 'var', 'yok', 'mı', 'mi', 'mu', 'mü',
        'ile', 'için', 'olan', 'tüm', 'sekme', 'kullanıcı', 'kullanıcılar', 'kullanıcılarda',
        'şekilde', 'düzenle', 'yap', 'et', 'büyük', 'küçük', 'harf', 'harfleri', 'harfle',
        'yazılı', 'gibi', 'bana', 'bunu', 'şunu', 'senle', 'sen', 'ben', 'veya', 'ama', 'fakat',
        'ancak', 'sadece', 'bütün', 'herkes', 'adları', 'soyadı', 'soyadları', 'isim', 'isimleri',
        'soy', 'soyad', 'soyadlar', 'kalan', 'güncelle', 'günceller', 'yaz', 'yazar', 'dönüştür',
        'kontrol', 'kontrolü', 'turkce', 'türkçe', 'karakter', 'karakterler', 'karakterleri',
        'isminde', 'soyisminde', 'kimsenin', 'olmaması', 'olmasın', 'lazım', 'gerek', 'lütfen',
        'şunları', 'bunları', 'olanları', 'eder', 'misin', 'misiniz', 'bak', 'temizle', 'çevir'
      ]);
      const rawWords = message.replace(/[^\w\sğüşıöçĞÜŞİÖÇ]/gi, ' ').split(/\s+/).filter(w => w.length >= 3 && !stopWords.has(w.toLowerCase()));
      for (const word of rawWords.slice(0, 5)) {
        const matchedUsers = await searchUsers(word);
        if (matchedUsers.length > 0) {
          relevantContext += `\n[BULUNAN KULLANICILAR ("${word}")]:\n`;
          matchedUsers.forEach(u => {
            relevantContext += `* ${u.name} (Snipe ID: ${u.id}, Kullanıcı Adı: ${u.username}, E-posta: ${u.email || 'Yok'}, Departman: ${u.department_name || 'Yok'}, Lokasyon: ${u.location_name || 'Yok'})\n`;
            if (u.assigned_assets?.length > 0) {
              relevantContext += `  Zimmetli Cihazlar:\n`;
              u.assigned_assets.forEach(a => {
                relevantContext += `  - Tag: ${a.asset_tag} | Model: ${a.model_name || a.name} | Seri: ${a.serial || 'Yok'} | Durum: ${a.status_name} (Asset ID: ${a.id})\n`;
              });
            } else {
              relevantContext += `  (Zimmetli cihazı yok)\n`;
            }
          });
        }

        const matchedAssets = await searchAssets(word);
        if (matchedAssets.length > 0) {
          relevantContext += `\n[BULUNAN CİHAZLAR ("${word}")]:\n`;
          matchedAssets.forEach(a => {
            relevantContext += `* Tag: ${a.asset_tag} (Snipe ID: ${a.id}) | Model: ${a.model_name || a.name} | Zimmetli: ${a.assigned_to_user_name || 'Boşta / Depoda'} (User ID: ${a.assigned_to_user_id || 'Yok'})\n`;
          });
        }
      }

      // 4. Format / Büyük-Küçük Harf / Genel Kullanıcı Talebi
      if (lowerMsg.includes('büyük') || lowerMsg.includes('küçük') || lowerMsg.includes('harf') || lowerMsg.includes('format') || lowerMsg.includes('soy') || lowerMsg.includes('tüm') || lowerMsg.includes('bütün') || lowerMsg.includes('isim')) {
        const [allDbUsers] = await pool.query('SELECT id, name, username, email FROM cached_users');
        relevantContext += `\n[SİSTEMDE KAYITLI PERSONEL LİSTESİ ÖRNEKLERİ (Toplam ${allDbUsers.length} kişi)]:\n`;
        allDbUsers.slice(0, 25).forEach(u => {
          relevantContext += `* ID: ${u.id} | Mevcut İsim: ${u.name} | Kullanıcı Adı: ${u.username}\n`;
        });
      }

      // 5. Türkçe Karakter Kontrol ve Temizleme Talebi
      if (lowerMsg.includes('türkçe') || lowerMsg.includes('turkce') || lowerMsg.includes('karakter') || lowerMsg.includes('ascii') || lowerMsg.includes('ingilizce') || lowerMsg.includes('temizle')) {
        function removeTurkishChars(str) {
          if (!str) return '';
          const map = { 'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G', 'ı': 'i', 'İ': 'I', 'ö': 'o', 'Ö': 'O', 'ş': 's', 'Ş': 'S', 'ü': 'u', 'Ü': 'U' };
          return str.replace(/[çÇğĞıİöÖşŞüÜ]/g, m => map[m] || m);
        }
        const [allDbUsers] = await pool.query('SELECT id, name, username, email FROM cached_users');
        const withTrChars = allDbUsers.filter(u => removeTurkishChars(u.name) !== u.name);
        
        relevantContext += `\n[TÜRKÇE KARAKTER İÇEREN KULLANICILAR (Toplam ${withTrChars.length} kişi)]:\n`;
        if (withTrChars.length > 0) {
          withTrChars.slice(0, 35).forEach(u => {
            relevantContext += `* ID: ${u.id} | Mevcut: ${u.name} -> ASCII: ${removeTurkishChars(u.name)} | Kullanıcı Adı: ${u.username}\n`;
          });
        }
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

- Tek Kullanıcı Silme:
[ACTION_PROPOSAL:{"type":"DELETE_USER","userId":12,"userName":"Ahmet YILMAZ","title":"Kullanıcıyı Sil","desc":"Zimmeti bulunmayan 'Ahmet YILMAZ' (ID: 12) kullanıcısı Snipe-IT sisteminden silinecek."}]

- Toplu E-Posta veya Bilgi Güncelleme (BULK_UPDATE_USERS):
[ACTION_PROPOSAL:{"type":"BULK_UPDATE_USERS","title":"Toplu E-Posta Güncelleme (B41)","desc":"Konumu B41 olan e-postası boş kullanıcıların adresleri güncellenecek.","location":"B41","domain":"@example.com","items":[{"userId":11,"userName":"Tugba ILBAY","email":"tugba.ilbay@example.com"}]}]

SADECE aşağıdaki veritabanı bilgilerini kullan:
${relevantContext}`;

      // Gemini Model Çağrısı
      const candidateModels = [
        'gemini-3.5-flash-lite',
        'gemini-3.1-flash-lite-preview',
        'gemini-3.5-flash',
        'gemini-2.5-flash'
      ];

      const cleanHistory = (Array.isArray(history) ? history.slice(-6) : []).map(h => ({
        role: h.sender === 'SnipeAI' ? 'model' : 'user',
        parts: [{ text: h.text || h.message || '' }]
      }));

      const contents = [...cleanHistory, { role: 'user', parts: [{ text: message }] }];

      let replyText = null;
      for (const m of candidateModels) {
        try {
          const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${GEMINI_API_KEY}`, {
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
        } catch (e) {
          console.warn(`[SnipeIT AI] Model ${m} failed:`, e.message);
        }
      }

      if (!replyText) {
        return res.status(500).json({ success: false, error: 'Snipe-IT AI şu anda yanıt üretemedi.' });
      }

      // Robust Action proposal parse
      let actionProposal = null;
      const startIdx = replyText.indexOf('[ACTION_PROPOSAL:');
      if (startIdx !== -1) {
        const jsonStart = startIdx + 17;
        const endIdx = replyText.lastIndexOf(']');
        if (endIdx > jsonStart) {
          const jsonStr = replyText.substring(jsonStart, endIdx).trim();
          try {
            actionProposal = JSON.parse(jsonStr);
          } catch (pe) {
            console.warn('[SnipeIT AI] Action proposal parse error:', pe.message);
          }
        }
        // Always strip the entire action block (and anything after it) from the human message
        replyText = replyText.substring(0, startIdx).trim();
      }
      replyText = replyText.replace(/\[ACTION_PROPOSAL:[\s\S]*/g, '').trim();

      res.json({
        success: true,
        reply: replyText,
        actionProposal,
        sender: 'SnipeAI'
      });

    } catch (err) {
      console.error('[SnipeIT AI] Chat exception:', err);
      dbError(res, err, 'snipe-ai:chat');
    }
  });

  // ── 3. Onaylanan Eylemi Gerçek Snipe-IT Sisteminde Çalıştırma Endpoint'i ──
  app.post('/api/snipe-ai/execute', async (req, res) => {
    try {
      const { action } = req.body;
      if (!action || !action.type) {
        return res.status(400).json({ success: false, error: 'Geçersiz eylem verisi.' });
      }

      await snipeitService.loadSettings();
      const client = snipeitService.getClient();

      let resultMsg = '';

      switch (action.type) {
        case 'CHECKIN_ASSET': {
          let assetId = action.assetId;
          let assetTag = action.assetTag;

          // Eğer assetId yoksa tag ile bul
          if (!assetId && assetTag) {
            const [found] = await pool.query('SELECT id, asset_tag FROM cached_assets WHERE asset_tag = ? LIMIT 1', [assetTag]);
            if (found.length > 0) assetId = found[0].id;
          }

          if (!assetId) {
            return res.status(400).json({ success: false, error: `Cihaz bulunamadı: ${assetTag || 'Tanımsız'}` });
          }

          const note = action.note || 'ServiceTracker Snipe-IT AI tarafından boşa çıkartıldı.';
          
          await client.post(`/hardware/${assetId}/checkin`, {
            note: note,
            status_id: 9 // Dağıtıma Hazır (Çıkma) - Deployable
          });

          // Yerel veritabanı önbelleğini güncelle
          await pool.query(
            'UPDATE cached_assets SET assigned_to_user_id = NULL, assigned_to_user_name = NULL, status_id = 9, status_name = "Dağıtıma Hazır (Çıkma)" WHERE id = ?',
            [assetId]
          );

          resultMsg = `✅ ${assetTag || 'Cihaz'} başarıyla boşa çıkartıldı ve depoya alındı!`;
          break;
        }

        case 'CHECKOUT_ASSET': {
          let assetId = action.assetId;
          let assetTag = action.assetTag;
          let targetUserId = action.targetUserId;
          let targetUserName = action.targetUserName;

          // 1. Asset ID bul
          if (!assetId && assetTag) {
            const [found] = await pool.query('SELECT id, asset_tag FROM cached_assets WHERE asset_tag = ? LIMIT 1', [assetTag]);
            if (found.length > 0) assetId = found[0].id;
          }

          // 2. Target User ID bul (Eğer AI varsayılan 45 vb. verdiyse veya kullanıcı ismiyle eşleşmiyorsa)
          if (targetUserName) {
            const cleanTargetName = targetUserName.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ]/g, ' ').trim();
            const words = cleanTargetName.split(/\s+/).filter(w => w.length >= 2);
            let userQuery = 'SELECT id, name FROM cached_users WHERE ';
            let userParams = [];
            
            if (words.length > 1) {
              userQuery += 'name LIKE ? AND name LIKE ? LIMIT 1';
              userParams = [`%${words[0]}%`, `%${words[1]}%`];
            } else if (words.length === 1) {
              userQuery += 'name LIKE ? OR username LIKE ? LIMIT 1';
              userParams = [`%${words[0]}%`, `%${words[0]}%`];
            }

            if (userParams.length > 0) {
              const [uFound] = await pool.query(userQuery, userParams);
              if (uFound.length > 0) {
                targetUserId = uFound[0].id;
                targetUserName = uFound[0].name;
              }
            }
          }

          if (!assetId) {
            return res.status(400).json({ success: false, error: `Cihaz bulunamadı: ${assetTag || 'Tanımsız'}` });
          }
          if (!targetUserId) {
            return res.status(400).json({ success: false, error: `Hedef kullanıcı bulunamadı: ${targetUserName || 'Tanımsız'}` });
          }

          const note = action.note || `${targetUserName} adına zimmetlendi.`;

          // Cihazın mevcut durumunu Snipe-IT'den kontrol et
          try {
            const currentAsset = await client.get(`/hardware/${assetId}`);
            if (currentAsset.data?.assigned_to) {
              // Zaten başkasına zimmetliyse önce boşa çıkart
              await client.post(`/hardware/${assetId}/checkin`, {
                note: 'Yeniden zimmetleme için boşa çıkartıldı.',
                status_id: 9
              });
            } else {
              // Boştaysa durumunun deployable olduğundan emin ol
              await client.patch(`/hardware/${assetId}`, { status_id: 9 });
            }
          } catch (chkErr) {
            console.warn('[SnipeIT AI Checkout Pre-check]', chkErr.message);
          }

          // Şimdi yeni kullanıcıya zimmetle
          const checkoutRes = await client.post(`/hardware/${assetId}/checkout`, {
            assigned_user: targetUserId,
            checkout_to_type: 'user',
            note: note
          });

          if (checkoutRes.data?.status === 'error') {
            throw new Error(checkoutRes.data.messages || 'Zimmetleme başarısız oldu.');
          }

          // Yerel önbelleği güncelle
          await pool.query(
            'UPDATE cached_assets SET assigned_to_user_id = ?, assigned_to_user_name = ?, status_id = 2, status_name = "Kullanıcı Atanmış" WHERE id = ?',
            [targetUserId, targetUserName, assetId]
          );

          resultMsg = `✅ ${assetTag || 'Cihaz'} başarıyla ${targetUserName} adına zimmetlendi!`;
          break;
        }

        case 'DELETE_USER': {
          let userId = action.userId;
          let userName = action.userName;

          if (!userId && userName) {
            const [uFound] = await pool.query('SELECT id, name FROM cached_users WHERE name LIKE ? LIMIT 1', [`%${userName}%`]);
            if (uFound.length > 0) userId = uFound[0].id;
          }

          if (!userId) {
            return res.status(400).json({ success: false, error: `Kullanıcı bulunamadı: ${userName || 'Tanımsız'}` });
          }

          await client.delete(`/users/${userId}`);

          // Yerel önbellekten sil
          await pool.query('DELETE FROM cached_users WHERE id = ?', [userId]);

          resultMsg = `✅ ${userName || 'Kullanıcı'} (ID: ${userId}) Snipe-IT sisteminden kalıcı olarak silindi!`;
          break;
        }

        case 'UPDATE_USER':
        case 'UPDATE_USER_NAME': {
          let userId = action.userId || action.targetUserId;
          let userName = action.userName || action.targetUserName;

          if (!userId && userName) {
            const [uFound] = await pool.query('SELECT id, name FROM cached_users WHERE name LIKE ? LIMIT 1', [`%${userName}%`]);
            if (uFound.length > 0) {
              userId = uFound[0].id;
              userName = uFound[0].name;
            }
          }

          if (!userId) {
            throw new Error('Güncellenecek kullanıcı ID bulunamadı.');
          }

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

          await client.patch(`/users/${userId}`, patchBody);

          if (patchBody.email) {
            await pool.query('UPDATE cached_users SET email = ? WHERE id = ?', [patchBody.email, userId]);
          }
          if (patchBody.first_name !== undefined || patchBody.last_name !== undefined) {
            const newFullName = `${patchBody.first_name || ''} ${patchBody.last_name || ''}`.trim();
            if (newFullName) {
              await pool.query('UPDATE cached_users SET name = ? WHERE id = ?', [newFullName, userId]);
              userName = newFullName;
            }
          }

          resultMsg = `✅ ${userName || 'Kullanıcı'} bilgileri Snipe-IT üzerinde başarıyla güncellendi!`;
          break;
        }

        case 'REMOVE_TURKISH_CHARS': {
          function removeTurkishChars(str) {
            if (!str) return '';
            const map = { 'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G', 'ı': 'i', 'İ': 'I', 'ö': 'o', 'Ö': 'O', 'ş': 's', 'Ş': 'S', 'ü': 'u', 'Ü': 'U' };
            return str.replace(/[çÇğĞıİöÖşŞüÜ]/g, m => map[m] || m);
          }

          const [allUsers] = await pool.query('SELECT id, name FROM cached_users');
          let successCount = 0;

          for (const u of allUsers) {
            const formattedName = removeTurkishChars(u.name);
            if (formattedName && formattedName !== u.name) {
              try {
                const words = formattedName.split(' ');
                const firstName = words.slice(0, -1).join(' ') || words[0];
                const lastName = words.length > 1 ? words[words.length - 1] : '';

                await client.patch(`/users/${u.id}`, {
                  first_name: firstName,
                  last_name: lastName
                });

                await pool.query('UPDATE cached_users SET name = ? WHERE id = ?', [formattedName, u.id]);
                successCount++;
                await new Promise(r => setTimeout(r, 60));
              } catch (patchErr) {
                console.warn(`[Remove Tr Chars Error for User ${u.id}]:`, patchErr.message);
              }
            }
          }

          resultMsg = `✅ Toplam ${successCount} kullanıcının ad ve soyadlarındaki Türkçe karakterler temizlenip ASCII formatına dönüştürüldü!`;
          break;
        }

        case 'FORMAT_ALL_USER_NAMES':
        case 'BULK_FORMAT_NAMES':
        case 'FORMAT_USER_NAMES':
        case 'TITLE_CASE_ALL': {
          function toTitleCaseTr(str) {
            if (!str) return '';
            return str.toLocaleLowerCase('tr-TR').split(/\s+/).map(w => w ? w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1) : '').join(' ');
          }

          const [allUsers] = await pool.query('SELECT id, name, username FROM cached_users');
          let successCount = 0;

          for (const u of allUsers) {
            const formattedName = toTitleCaseTr(u.name);
            if (formattedName && formattedName !== u.name) {
              try {
                const words = formattedName.split(' ');
                const firstName = words.slice(0, -1).join(' ') || words[0];
                const lastName = words.length > 1 ? words[words.length - 1] : '';

                await client.patch(`/users/${u.id}`, {
                  first_name: firstName,
                  last_name: lastName
                });

                await pool.query('UPDATE cached_users SET name = ? WHERE id = ?', [formattedName, u.id]);
                successCount++;
                await new Promise(r => setTimeout(r, 60));
              } catch (patchErr) {
                console.warn(`[Format Name Error for User ${u.id}]:`, patchErr.message);
              }
            }
          }

          resultMsg = `✅ Toplam ${successCount} kullanıcının ad ve soyadları başarıyla 'İlk Harf Büyük' (Title Case) formatına dönüştürüldü!`;
          break;
        }

        case 'UPPERCASE_SURNAMES':
        case 'FORMAT_UPPERCASE_SURNAMES': {
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

          const [allUsers] = await pool.query('SELECT id, name FROM cached_users');
          let successCount = 0;

          for (const u of allUsers) {
            const formattedName = formatNameUppercaseSurname(u.name);
            if (formattedName && formattedName !== u.name) {
              try {
                const words = formattedName.split(' ');
                const firstName = words.slice(0, -1).join(' ') || words[0];
                const lastName = words.length > 1 ? words[words.length - 1] : '';

                await client.patch(`/users/${u.id}`, {
                  first_name: firstName,
                  last_name: lastName
                });

                await pool.query('UPDATE cached_users SET name = ? WHERE id = ?', [formattedName, u.id]);
                successCount++;
                await new Promise(r => setTimeout(r, 60));
              } catch (patchErr) {
                console.warn(`[Uppercase Surname Error for User ${u.id}]:`, patchErr.message);
              }
            }
          }

          resultMsg = `✅ Toplam ${successCount} kullanıcının soyisimleri büyük harfe (Ad SOYAD) dönüştürüldü!`;
          break;
        }

        case 'BULK_UPDATE_USERS': {
          let items = action.items || [];
          let successCount = 0;

          // Eğer items içinde doğrudan kullanıcı listesi varsa (isim veya email güncellemesi)
          if (items.length > 0) {
            for (const item of items) {
              const uId = item.userId || item.id;
              if (!uId) continue;

              const patchBody = {};
              if (item.email) patchBody.email = item.email;
              if (item.first_name || item.lastName || item.name) {
                const fullName = item.name || `${item.first_name || ''} ${item.last_name || ''}`.trim();
                const words = fullName.split(' ');
                patchBody.first_name = words.slice(0, -1).join(' ') || words[0];
                patchBody.last_name = words.length > 1 ? words[words.length - 1] : '';
              }

              if (Object.keys(patchBody).length > 0) {
                try {
                  await client.patch(`/users/${uId}`, patchBody);
                  if (patchBody.email) {
                    await pool.query('UPDATE cached_users SET email = ? WHERE id = ?', [patchBody.email, uId]);
                  }
                  if (patchBody.first_name !== undefined) {
                    const newFullName = `${patchBody.first_name} ${patchBody.last_name}`.trim();
                    await pool.query('UPDATE cached_users SET name = ? WHERE id = ?', [newFullName, uId]);
                  }
                  successCount++;
                  await new Promise(r => setTimeout(r, 60));
                } catch (e) {
                  console.warn(`[Bulk user patch err ${uId}]:`, e.message);
                }
              }
            }
            resultMsg = `✅ Toplam ${successCount} kullanıcının bilgileri Snipe-IT üzerinde başarıyla güncellendi!`;
            break;
          }

          // Otomatik konum/departman e-posta tamamlama
          if (action.location) {
            const [locUsers] = await pool.query(
              `SELECT id, name, username, email FROM cached_users 
               WHERE (location_name LIKE ? OR department_name LIKE ?) AND (email IS NULL OR TRIM(email) = '')`,
              [`%${action.location}%`, `%${action.location}%`]
            );
            items = locUsers.map(u => {
              const cleanUser = (u.username || u.name.toLowerCase().replace(/[^a-zA-Z0-9]/g, '.')).replace(/\.+/g, '.');
              return {
                userId: u.id,
                userName: u.name,
                email: `${cleanUser}${action.domain || '@example.com'}`
              };
            });

            for (const item of items) {
              try {
                if (item.email && item.userId) {
                  await client.patch(`/users/${item.userId}`, { email: item.email });
                  await pool.query('UPDATE cached_users SET email = ? WHERE id = ?', [item.email, item.userId]);
                  successCount++;
                  await new Promise(r => setTimeout(r, 60));
                }
              } catch (itemErr) {
                console.warn(`[SnipeIT AI Bulk] Failed for user ${item.userId}:`, itemErr.message);
              }
            }
          }

          resultMsg = `✅ Toplam ${successCount} kullanıcının bilgileri Snipe-IT üzerinde başarıyla güncellendi!`;
          break;
        }

        default:
          return res.status(400).json({ success: false, error: 'Bilinmeyen eylem türü: ' + action.type });
      }

      res.json({
        success: true,
        message: resultMsg
      });

    } catch (err) {
      console.error('[SnipeIT AI] Execute error:', err);
      const apiMsg = err.response?.data?.messages || err.response?.data?.message || err.message;
      res.status(500).json({
        success: false,
        error: 'Snipe-IT API hatası: ' + JSON.stringify(apiMsg)
      });
    }
  });
};
