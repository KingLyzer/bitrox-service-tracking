const axios = require('axios');
const { getDb, dbGet, dbTransaction, syncMysqlTables, ensureLocalSyncIds } = require('../db/database');

class SnipeITService {
  constructor() {
    this.apiUrl = '';
    this.apiKey = '';
    this.syncPromise = null;
  }

  async loadSettings() {
    try {
      const response = await axios.get('http://128.1.1.10:3000/api/snipe-config', { timeout: 5000 });
      const config = response.data;
      const snipeConfig = config.success && config.config ? config.config : config;
      
      const url = snipeConfig.snipe_url || snipeConfig.snipeit_url || '';
      const token = snipeConfig.snipe_token || snipeConfig.snipeit_api_key || '';

      this.apiUrl = url
        ? String(url).trim().replace(/\/+$/, '').replace(/\/api\/v1$/i, '')
        : '';
      this.apiKey = token
        ? String(token).trim().replace(/^Bearer\s+/i, '').trim()
        : '';
    } catch (err) {
      console.warn('[SnipeIT Service] Failed to load settings from central server:', err.message);
    }
  }

  getClient(options = {}) {
    const apiUrl = options.apiUrl || this.apiUrl;
    const apiKey = options.apiKey || this.apiKey;
    if (!apiUrl || !apiKey) {
      throw new Error('Snipe-IT URL veya API Key ayarlanmamış.');
    }
    const client = axios.create({
      baseURL: `${apiUrl}/api/v1`,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    client.interceptors.response.use(null, async (error) => {
      const config = error.config;
      if (error.response?.status === 429 && !config._retried) {
        config._retried = true;
        const retryAfter = parseInt(error.response.headers['retry-after'] || '10', 10);
        const waitMs = (Number.isFinite(retryAfter) ? retryAfter : 10) * 1000;
        console.warn(`[SnipeIT] 429 Rate limit — ${waitMs / 1000}s beklenecek...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        return client(config);
      }
      return Promise.reject(error);
    });

    return client;
  }

  async fetchAllPages(endpoint, client = null) {
    if (!client) {
      await this.loadSettings();
    }
    const apiClient = client || this.getClient();
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    let allData = [];
    let offset = 0;
    const limit = 500;
    let hasMore = true;

    while (hasMore) {
      const separator = endpoint.includes('?') ? '&' : '?';
      const response = await apiClient.get(`${endpoint}${separator}limit=${limit}&offset=${offset}`);
      
      const { rows, total } = response.data;
      if (!rows || rows.length === 0) {
        hasMore = false;
        break;
      }

      allData = allData.concat(rows);
      offset += limit;
      
      if (allData.length >= total) {
        hasMore = false;
      } else {
        await delay(300);
      }
    }
    return allData;
  }

  async syncAll() {
    if (this.syncPromise) {
      console.log('[SnipeIT] Devam eden senkronizasyon bekleniyor...');
      return this.syncPromise;
    }

    this.syncPromise = this._syncAll();
    try {
      return await this.syncPromise;
    } finally {
      this.syncPromise = null;
    }
  }

  async _syncAll() {
    try {
      console.log('[SnipeIT] Senkronizasyon başlatılıyor...');
      await this.loadSettings();
      const client = this.getClient({
        apiUrl: this.apiUrl,
        apiKey: this.apiKey,
        skipReload: true,
      });
      
      const endpoints = {
        users: { url: '/users', table: 'cached_users' },
        locations: { url: '/locations', table: 'cached_locations' },
        companies: { url: '/companies', table: 'cached_companies' },
        suppliers: { url: '/suppliers', table: 'cached_suppliers' },
        categories: { url: '/categories', table: 'cached_categories' },
        models: { url: '/models', table: 'cached_models' },
        manufacturers: { url: '/manufacturers', table: 'cached_manufacturers' },
        assets: { url: '/hardware', table: 'cached_assets' },
        components: { url: '/components', table: 'stock_items' },
        consumables: { url: '/consumables', table: 'toner_items' },
      };

      const syncResults = {};
      const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

      for (const [key, config] of Object.entries(endpoints)) {
        try {
          console.log(`[SnipeIT] Veriler çekiliyor: ${key}...`);
          const data = await this.fetchAllPages(config.url, client);
          console.log(`[SnipeIT] ${data.length} adet ${key} çekildi. Veritabanına yazılıyor...`);
          await this._saveToCache(config.table, data, key);
          syncResults[key] = data.length;
        } catch (error) {
          console.error(`[SnipeIT] ${key} senkronizasyon hatası:`, error.message);
          syncResults[key] = `Hata: ${error.message}`;
        }
        await delay(400);
      }

      const criticalErrors = ['users', 'consumables', 'components'].filter(key => typeof syncResults[key] === 'string');
      if (criticalErrors.length > 0) {
        const details = criticalErrors.map(key => `${key}: ${syncResults[key].replace(/^Hata:\s*/, '')}`).join(' | ');
        return { success: false, message: details, results: syncResults };
      }

      try {
        console.log('[SnipeIT] Toner checkout geçmişi çekiliyor...');
        const historyResult = await this.syncCheckedoutHistory();
        syncResults.checkoutHistory = historyResult.synced ?? 0;
      } catch (e) {
        console.error('[SnipeIT] Checkout geçmişi sync hatası:', e.message);
        syncResults.checkoutHistory = `Hata: ${e.message}`;
      }

      console.log('[SnipeIT] Senkronizasyon başarıyla tamamlandı.', syncResults);
      return { success: true, results: syncResults };
    } catch (error) {
      console.error('[SnipeIT] Senkronizasyon hatası:', error.message);
      return { success: false, message: error.message };
    }
  }

  async _saveToCache(tableName, dataList, type) {
    const rows = Array.isArray(dataList) ? dataList : [];

    dbTransaction(() => {
      // Önce mevcutları temizle. MySQL'e tablo bazlı toplu sync yapılacağı için
      // burada doğrudan SQLite yazıyoruz.
      if (type !== 'consumables' && type !== 'components') {
        getDb().prepare(`DELETE FROM ${tableName}`).run();
      }

      if (type === 'assets') {
        const stmt = getDb().prepare(`
          INSERT INTO cached_assets 
          (id, name, asset_tag, serial, model_id, model_name, category_name, status_id, status_name, 
           assigned_to_user_id, assigned_to_user_name, location_id, location_name, manufacturer_id, manufacturer_name)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const item of rows) {
          stmt.run(
            item.id,
            item.name || '',
            item.asset_tag || '',
            item.serial || '',
            item.model ? item.model.id : null,
            item.model ? item.model.name : null,
            item.category ? item.category.name : null,
            item.status_label ? item.status_label.id : null,
            item.status_label ? item.status_label.name : null,
            item.assigned_to && item.assigned_to.type === 'user' ? item.assigned_to.id : null,
            item.assigned_to && item.assigned_to.type === 'user' ? item.assigned_to.name : null,
            item.location ? item.location.id : null,
            item.location ? item.location.name : null,
            item.manufacturer ? item.manufacturer.id : null,
            item.manufacturer ? item.manufacturer.name : null
          );
        }
      } else if (type === 'users') {
        const stmt = getDb().prepare(`INSERT INTO cached_users (id, username, name, email, department_id, department_name, location_id, location_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
        for (const item of rows) {
          stmt.run(
            item.id, item.username || '', item.name || '', item.email || '',
            item.department ? item.department.id : null, item.department ? item.department.name : null,
            item.location ? item.location.id : null, item.location ? item.location.name : null
          );
        }
      } else if (type === 'locations') {
        const stmt = getDb().prepare(`
          INSERT INTO cached_locations
          (id, name, address, address2, city, state, country, zip, parent_id, parent_name)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const item of rows) {
          stmt.run(
            item.id,
            item.name || '',
            item.address || '',
            item.address2 || item.address_2 || '',
            item.city || '',
            item.state || '',
            item.country || '',
            item.zip || item.zipcode || item.postal_code || '',
            this._refId(item.parent),
            this._refName(item.parent)
          );
        }
      } else if (type === 'companies') {
        const stmt = getDb().prepare(`INSERT INTO cached_companies (id, name) VALUES (?, ?)`);
        for (const item of rows) {
          stmt.run(item.id, item.name || '');
        }
      } else if (type === 'suppliers') {
        const stmt = getDb().prepare(`INSERT INTO cached_suppliers (id, name) VALUES (?, ?)`);
        for (const item of rows) {
          stmt.run(item.id, item.name || '');
        }
      } else if (type === 'categories') {
        const stmt = getDb().prepare(`INSERT INTO cached_categories (id, name, category_type) VALUES (?, ?, ?)`);
        for (const item of rows) {
          stmt.run(item.id, item.name || '', item.category_type || item.type || '');
        }
      } else if (type === 'models') {
        const stmt = getDb().prepare(`INSERT INTO cached_models (id, name, manufacturer_id, manufacturer_name, category_id, category_name) VALUES (?, ?, ?, ?, ?, ?)`);
        for (const item of rows) {
          stmt.run(
            item.id, item.name || '',
            item.manufacturer ? item.manufacturer.id : null, item.manufacturer ? item.manufacturer.name : null,
            item.category ? item.category.id : null, item.category ? item.category.name : null
          );
        }
      } else if (type === 'manufacturers') {
        const stmt = getDb().prepare(`INSERT INTO cached_manufacturers (id, name) VALUES (?, ?)`);
        for (const item of rows) {
          stmt.run(item.id, item.name || '');
        }
      } else if (type === 'consumables') {
        this._saveConsumables(rows);
      } else if (type === 'components') {
        this._saveComponents(rows);
      }
    });

    ensureLocalSyncIds(tableName);
    await syncMysqlTables([tableName]);
  }

  _refId(value) {
    if (!value) return null;
    if (typeof value === 'object') return value.id || null;
    return null;
  }

  _refName(value) {
    if (!value) return null;
    if (typeof value === 'object') return value.name || value.companyName || null;
    return String(value);
  }

  _plainDate(value) {
    if (!value) return null;
    if (typeof value === 'object') return value.date || value.datetime || null;
    return String(value).slice(0, 10);
  }

  _saveConsumables(rows) {
    const selectBySnipe = getDb().prepare('SELECT id FROM toner_items WHERE snipeit_consumable_id=?');
    const selectByName = getDb().prepare('SELECT id FROM toner_items WHERE toner_model=? AND (snipeit_consumable_id IS NULL OR snipeit_consumable_id=0) LIMIT 1');
    const update = getDb().prepare(`
      UPDATE toner_items SET
        toner_code=?, toner_model=?, color=?, qty=?, critical_qty=?, unit_price=?,
        company_id=?, company_name=?, category_id=?, category_name=?, supplier_id=?, supplier_name=?,
        manufacturer_id=?, manufacturer_name=?, location_id=?, location_name=?, model_number=?,
        item_no=?, order_number=?, purchase_date=?, purchase_cost=?, total_qty=?, available_qty=?,
        notes=?, snipeit_consumable_id=?, is_active=1
      WHERE id=?
    `);
    const insert = getDb().prepare(`
      INSERT INTO toner_items (
        toner_code, toner_model, color, qty, critical_qty, unit_price,
        company_id, company_name, category_id, category_name, supplier_id, supplier_name,
        manufacturer_id, manufacturer_name, location_id, location_name, model_number,
        item_no, order_number, purchase_date, purchase_cost, total_qty, available_qty,
        notes, snipeit_consumable_id, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    for (const item of rows) {
      const categoryName = this._refName(item.category) || '';

      const snipeId = item.id;
      const name = item.name || '';
      const totalQty = Number(item.qty ?? item.total ?? 0) || 0;
      const availableQty = Number(item.remaining ?? item.available_qty ?? item.remaining_qty ?? totalQty) || 0;
      const purchaseCost = Number(item.purchase_cost ?? item.purchaseCost ?? 0) || 0;
      const values = [
        `SNIPE-${snipeId}`,
        name,
        item.item_no || '',
        availableQty,
        Number(item.min_amt ?? item.min_qty ?? 0) || 0,
        purchaseCost,
        this._refId(item.company), this._refName(item.company) || item.companyName || null,
        this._refId(item.category), categoryName || null,
        this._refId(item.supplier), this._refName(item.supplier),
        this._refId(item.manufacturer), this._refName(item.manufacturer),
        this._refId(item.location), this._refName(item.location),
        item.model_number || item.model_no || '',
        item.item_no || '',
        item.order_number || '',
        this._plainDate(item.purchase_date),
        purchaseCost,
        totalQty,
        availableQty,
        item.notes || '',
        snipeId,
      ];

      const existing = selectBySnipe.get(snipeId) || (name ? selectByName.get(name) : null);
      if (existing) update.run(...values, existing.id);
      else insert.run(...values);
    }
  }

  _saveComponents(rows) {
    const selectBySnipe = getDb().prepare('SELECT id FROM stock_items WHERE snipeit_component_id=?');
    const selectByName = getDb().prepare('SELECT id FROM stock_items WHERE name=? AND (snipeit_component_id IS NULL OR snipeit_component_id=0) LIMIT 1');
    const update = getDb().prepare(`
      UPDATE stock_items SET
        stock_code=?, name=?, category_id=?, brand_compat=?, model_compat=?, qty=?, unit=?,
        critical_qty=?, unit_price=?, supplier_id=?, location=?, description=?,
        snipeit_component_id=?, snipeit_category_id=?, category_name=?, company_id=?, company_name=?,
        supplier_name=?, manufacturer_id=?, manufacturer_name=?, location_id=?, location_name=?,
        model_number=?, serial_no=?, order_number=?, purchase_date=?, purchase_cost=?,
        total_qty=?, available_qty=?, is_active=1, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `);
    const insert = getDb().prepare(`
      INSERT INTO stock_items (
        stock_code, name, category_id, brand_compat, model_compat, qty, unit,
        critical_qty, unit_price, supplier_id, location, description,
        snipeit_component_id, snipeit_category_id, category_name, company_id, company_name,
        supplier_name, manufacturer_id, manufacturer_name, location_id, location_name,
        model_number, serial_no, order_number, purchase_date, purchase_cost,
        total_qty, available_qty, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    for (const item of rows) {
      const snipeId = item.id;
      const name = item.name || '';
      const categoryId = this._refId(item.category);
      const categoryName = this._refName(item.category) || '';
      const totalQty = Number(item.qty ?? item.total ?? 0) || 0;
      const availableQty = Number(item.remaining ?? item.available_qty ?? item.remaining_qty ?? totalQty) || 0;
      const purchaseCost = Number(item.purchase_cost ?? item.purchaseCost ?? 0) || 0;
      const manufacturerName = this._refName(item.manufacturer);
      const modelNumber = item.model_number || item.model_no || '';
      const locationName = this._refName(item.location);
      const values = [
        `SNIPE-COMP-${snipeId}`,
        name,
        categoryId,
        manufacturerName || '',
        modelNumber,
        availableQty,
        'Adet',
        Number(item.min_amt ?? item.min_qty ?? 0) || 0,
        purchaseCost,
        this._refId(item.supplier),
        locationName || '',
        item.notes || '',
        snipeId,
        categoryId,
        categoryName || null,
        this._refId(item.company),
        this._refName(item.company) || item.companyName || null,
        this._refName(item.supplier),
        this._refId(item.manufacturer),
        manufacturerName,
        this._refId(item.location),
        locationName,
        modelNumber,
        item.serial || '',
        item.order_number || '',
        this._plainDate(item.purchase_date),
        purchaseCost,
        totalQty,
        availableQty,
      ];

      const existing = selectBySnipe.get(snipeId) || (name ? selectByName.get(name) : null);
      if (existing) update.run(...values, existing.id);
      else insert.run(...values);
    }
  }

  _compactPayload(data) {
    return Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined && value !== null && value !== '')
    );
  }

  async saveConsumable(data) {
    try {
      await this.loadSettings();
      const client = this.getClient();
      const payload = this._compactPayload({
        name: data.name,
        company_id: data.company_id,
        category_id: data.category_id,
        qty: Number(data.qty) || 0,
        min_amt: Number(data.min_amt) || 0,
        supplier_id: data.supplier_id,
        manufacturer_id: data.manufacturer_id,
        location_id: data.location_id,
        model_number: data.model_number,
        item_no: data.item_no,
        order_number: data.order_number,
        purchase_date: data.purchase_date,
        purchase_cost: Number(data.purchase_cost) || 0,
        notes: data.notes,
      });
      const response = data.id
        ? await client.patch(`/consumables/${data.id}`, payload)
        : await client.post('/consumables', payload);
      if (response.data?.status === 'error') {
        return { success: false, message: response.data?.messages || response.data?.message || 'Snipe-IT kayıt hatası.' };
      }
      const consumables = await this.fetchAllPages('/consumables');
      await this._saveToCache('toner_items', consumables, 'consumables');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, message: error.response?.data?.messages || error.response?.data?.message || error.message };
    }
  }

  async checkoutConsumable({ consumableId, assignedTo, qty = 1, notes }) {
    try {
      await this.loadSettings();
      const client = this.getClient();
      const response = await client.post(`/consumables/${consumableId}/checkout`, this._compactPayload({
        assigned_to: assignedTo,
        checkout_qty: Number(qty) || 1,
        note: notes,
      }));
      if (response.data?.status === 'error') {
        return { success: false, message: response.data?.messages || response.data?.message || 'Snipe-IT çıkış hatası.' };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, message: error.response?.data?.messages || error.response?.data?.message || error.message };
    }
  }

  async saveComponent(data) {
    try {
      await this.loadSettings();
      const client = this.getClient();
      const payload = this._compactPayload({
        name: data.name,
        category_id: data.category_id,
        qty: Number(data.qty) || 0,
        min_amt: Number(data.min_amt) || 0,
        serial: data.serial,
        manufacturer_id: data.manufacturer_id,
        location_id: data.location_id,
        company_id: data.company_id,
        supplier_id: data.supplier_id,
        model_number: data.model_number,
        order_number: data.order_number,
        purchase_date: data.purchase_date,
        purchase_cost: Number(data.purchase_cost) || 0,
        notes: data.notes,
      });
      const response = data.id
        ? await client.put(`/components/${data.id}`, payload)
        : await client.post('/components', payload);
      if (response.data?.status === 'error') {
        return { success: false, message: response.data?.messages || response.data?.message || 'Snipe-IT bileşen kayıt hatası.' };
      }
      const components = await this.fetchAllPages('/components');
      await this._saveToCache('stock_items', components, 'components');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, message: error.response?.data?.messages || error.response?.data?.message || error.message };
    }
  }

  async syncCheckedoutHistory() {
    try {
      await this.loadSettings();
      const client = this.getClient();
      const db = getDb();

      try {
        db.exec('ALTER TABLE toner_changes ADD COLUMN snipeit_checkout_id TEXT');
      } catch (e) {}
      
      try {
        db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_toner_changes_snipeit_checkout ON toner_changes (snipeit_checkout_id)');
      } catch (e) {}

      // Mükerrer senkronizasyon kayıtlarını temizle (Geçmişte oluşan hatalı kopyalar için)
      try {
        db.exec(`
          DELETE FROM toner_changes 
          WHERE snipeit_checkout_id IS NOT NULL 
          AND id NOT IN (
            SELECT MIN(id) 
            FROM toner_changes 
            WHERE snipeit_checkout_id IS NOT NULL 
            GROUP BY snipeit_checkout_id
          )
        `);
      } catch (e) {
        console.warn('[SnipeIT] Mükerrer temizlik işlemi hatası:', e.message);
      }

      const activities = await this.fetchAllPages(
        '/reports/activity?item_type=consumable&action_type=checkout&sort=created_at&order=asc',
        client
      );

      const insertChange = db.prepare(`
        INSERT OR IGNORE INTO toner_changes
          (toner_id, change_date, assigned_user_id, assigned_user_name, qty, notes, snipeit_checkout_id, created_at)
        SELECT
          ti.id,
          COALESCE(:checkout_at, date('now')),
          :user_id,
          :user_name,
          :qty,
          :notes,
          :checkout_id,
          COALESCE(:checkout_at, CURRENT_TIMESTAMP)
        FROM toner_items ti
        WHERE ti.snipeit_consumable_id = :consumable_id
        LIMIT 1
      `);

      let synced = 0;
      for (const row of activities) {
        const consumableId = row.item?.id || null;
        if (!consumableId) continue;
        const checkoutId = String(row.id);
        const userId = row.target?.id || null;
        const userName = row.target?.name || row.admin?.name || null;
        const checkoutAt = row.created_at?.datetime || row.created_at?.date || null;
        const qty = Number(row.item?.qty || 1);
        const result = insertChange.run({
          consumable_id: consumableId,
          checkout_id: checkoutId,
          user_id: userId,
          user_name: userName,
          qty,
          notes: row.note || null,
          checkout_at: checkoutAt ? checkoutAt.slice(0, 10) : null,
        });
        if (result.changes > 0) synced++;
      }

      console.log(`[SnipeIT] Checkout geçmişi senkronize edildi: ${synced} yeni kayıt`);
      if (synced > 0) {
        ensureLocalSyncIds('toner_changes');
        await syncMysqlTables(['toner_changes']);
      }
      return { success: true, synced };
    } catch (error) {
      console.error('[SnipeIT] Checkout geçmişi sync hatası:', error.message);
      return { success: false, message: error.message };
    }
  }
}

module.exports = new SnipeITService();
