const axios = require('axios');

class SnipeITService {
  constructor(pool) {
    this.pool = pool;
    this.apiUrl = '';
    this.apiKey = '';
    this.syncPromise = null;
  }

  async loadSettings() {
    this.apiUrl = process.env.SNIPE_URL || '';
    this.apiKey = process.env.SNIPE_API_KEY || process.env.SNIPE_TOKEN || '';

    if (this.pool) {
      try {
        const [rows] = await this.pool.execute(
          'SELECT `key`, `value` FROM settings WHERE `key` IN ("snipeit_url", "snipe_url", "snipeit_api_key", "snipe_token")'
        );
        for (const row of rows) {
          if ((row.key === 'snipeit_url' || row.key === 'snipe_url') && row.value) {
            this.apiUrl = row.value;
          }
          if ((row.key === 'snipeit_api_key' || row.key === 'snipe_token') && row.value) {
            this.apiKey = row.value;
          }
        }
      } catch (err) {
        console.warn('[SnipeIT] DB settings error:', err.message);
      }
    }

    this.apiUrl = this.apiUrl.trim().replace(/\/+$/, '').replace(/\/api\/v1$/i, '');
    this.apiKey = this.apiKey.trim().replace(/^Bearer\s+/i, '').trim();

    if (this.apiUrl.startsWith('http://') && !this.apiUrl.includes('localhost') && !this.apiUrl.includes('127.0.0.1')) {
      this.apiUrl = this.apiUrl.replace('http://', 'https://');
    }
  }

  getClient() {
    if (!this.apiUrl || !this.apiKey) {
      throw new Error('Snipe-IT URL veya API Key ayarlanmamış.');
    }
    const client = axios.create({
      baseURL: `${this.apiUrl}/api/v1`,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
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

  async fetchAllPages(endpoint, client) {
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    let allData = [];
    let offset = 0;
    const limit = 500;
    let hasMore = true;

    while (hasMore) {
      const separator = endpoint.includes('?') ? '&' : '?';
      const response = await client.get(`${endpoint}${separator}limit=${limit}&offset=${offset}`);
      
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

  async _batchInsert(conn, table, columns, rows) {
    if (!rows || rows.length === 0) return;
    const BATCH_SIZE = 200;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const chunk = rows.slice(i, i + BATCH_SIZE);
      const rowPlaceholders = `(${columns.map(() => '?').join(', ')})`;
      const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${chunk.map(() => rowPlaceholders).join(', ')}`;
      const params = chunk.flat();
      await conn.query(sql, params);
    }
  }

  async syncAll(force = false) {
    if (this.syncPromise) {
      console.log('[SnipeIT] Devam eden senkronizasyon bekleniyor...');
      return this.syncPromise;
    }

    const now = Date.now();
    if (!force && this.lastSyncTime && (now - this.lastSyncTime < 15 * 60 * 1000)) {
      console.log('[SnipeIT] Senkronizasyon çok yakın zamanda yapıldı (15 dk cooldown). Önbellek güncel.');
      return { success: true, cached: true, message: 'Veriler güncel (önbellek kullanıldı).' };
    }

    this.syncPromise = this._syncAll();
    try {
      const result = await this.syncPromise;
      if (result && result.success) {
        this.lastSyncTime = Date.now();
      }
      return result;
    } finally {
      this.syncPromise = null;
    }
  }

  async _syncAll() {
    const conn = await this.pool.getConnection();
    try {
      console.log('[SnipeIT] Senkronizasyon başlatılıyor...');
      await this.loadSettings();
      const client = this.getClient();
      
      const endpoints = {
        users: '/users',
        locations: '/locations',
        companies: '/companies',
        suppliers: '/suppliers',
        categories: '/categories',
        models: '/models',
        manufacturers: '/manufacturers',
        assets: '/hardware',
        consumables: '/consumables',
      };

      const syncResults = {};
      const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

      for (const [key, url] of Object.entries(endpoints)) {
        try {
          console.log(`[SnipeIT] Veriler çekiliyor: ${key}...`);
          const data = await this.fetchAllPages(url, client);
          console.log(`[SnipeIT] ${data.length} adet ${key} çekildi. Veritabanına yazılıyor...`);
          
          await conn.beginTransaction();

          if (key === 'users') {
            await conn.execute('DELETE FROM cached_users');
            const rows = data.map(item => [
              item.id, item.username || '', item.name || '', item.email || '',
              this._refId(item.department), this._refName(item.department),
              this._refId(item.location), this._refName(item.location)
            ]);
            await this._batchInsert(conn, 'cached_users', ['id', 'username', 'name', 'email', 'department_id', 'department_name', 'location_id', 'location_name'], rows);
          } else if (key === 'locations') {
            await conn.execute('DELETE FROM cached_locations');
            const rows = data.map(item => [
              item.id, item.name || '', item.address || '', item.address2 || item.address_2 || '',
              item.city || '', item.state || '', item.country || '',
              item.zip || item.zipcode || item.postal_code || '',
              this._refId(item.parent), this._refName(item.parent),
              this._refId(item.manager), this._refName(item.manager)
            ]);
            await this._batchInsert(conn, 'cached_locations', ['id', 'name', 'address', 'address2', 'city', 'state', 'country', 'zip', 'parent_id', 'parent_name', 'manager_id', 'manager_name'], rows);
          } else if (key === 'companies') {
            await conn.execute('DELETE FROM cached_companies');
            const rows = data.map(item => [item.id, item.name || '']);
            await this._batchInsert(conn, 'cached_companies', ['id', 'name'], rows);
          } else if (key === 'suppliers') {
            await conn.execute('DELETE FROM cached_suppliers');
            const rows = data.map(item => [item.id, item.name || '']);
            await this._batchInsert(conn, 'cached_suppliers', ['id', 'name'], rows);
          } else if (key === 'categories') {
            await conn.execute('DELETE FROM cached_categories');
            const rows = data.map(item => [item.id, item.name || '', item.type || '']);
            await this._batchInsert(conn, 'cached_categories', ['id', 'name', 'category_type'], rows);
          } else if (key === 'manufacturers') {
            await conn.execute('DELETE FROM cached_manufacturers');
            const rows = data.map(item => [item.id, item.name || '']);
            await this._batchInsert(conn, 'cached_manufacturers', ['id', 'name'], rows);
          } else if (key === 'models') {
            await conn.execute('DELETE FROM cached_models');
            const rows = data.map(item => [
              item.id, item.name || '',
              this._refId(item.manufacturer), this._refName(item.manufacturer),
              this._refId(item.category), this._refName(item.category)
            ]);
            await this._batchInsert(conn, 'cached_models', ['id', 'name', 'manufacturer_id', 'manufacturer_name', 'category_id', 'category_name'], rows);
          } else if (key === 'assets') {
            await conn.execute('DELETE FROM cached_assets');
            const rows = data.map(item => [
              item.id, item.name || '', item.asset_tag || '', item.serial || '',
              item.model ? item.model.id : null, item.model ? item.model.name : null,
              item.category ? item.category.name : null,
              item.status_label ? item.status_label.id : null, item.status_label ? item.status_label.name : null,
              item.assigned_to && item.assigned_to.type === 'user' ? item.assigned_to.id : null,
              item.assigned_to && item.assigned_to.type === 'user' ? item.assigned_to.name : null,
              item.location ? item.location.id : null, item.location ? item.location.name : null,
              item.manufacturer ? item.manufacturer.id : null, item.manufacturer ? item.manufacturer.name : null
            ]);
            await this._batchInsert(conn, 'cached_assets', [
              'id', 'name', 'asset_tag', 'serial', 'model_id', 'model_name', 'category_name', 'status_id', 'status_name',
              'assigned_to_user_id', 'assigned_to_user_name', 'location_id', 'location_name', 'manufacturer_id', 'manufacturer_name'
            ], rows);
          } else if (key === 'consumables') {
            for (const item of data) {
              const categoryName = this._refName(item.category) || '';
              const snipeId = item.id;
              const name = item.name || '';
              const totalQty = Number(item.qty ?? item.total ?? 0) || 0;
              const availableQty = Number(item.remaining ?? item.available_qty ?? item.remaining_qty ?? totalQty) || 0;
              const purchaseCost = Number(item.purchase_cost ?? 0) || 0;

              const [existingRows] = await conn.execute(
                'SELECT id FROM toner_items WHERE snipeit_consumable_id = ? OR (toner_model = ? AND (snipeit_consumable_id IS NULL OR snipeit_consumable_id = 0)) LIMIT 1',
                [snipeId, name]
              );

              const params = [
                `SNIPE-${snipeId}`, name, item.item_no || '', availableQty,
                Number(item.min_amt ?? 0) || 0, purchaseCost,
                this._refId(item.company), this._refName(item.company) || null,
                this._refId(item.category), categoryName || null,
                this._refId(item.supplier), this._refName(item.supplier),
                this._refId(item.manufacturer), this._refName(item.manufacturer),
                this._refId(item.location), this._refName(item.location),
                item.model_number || '', item.item_no || '', item.order_number || '',
                this._plainDate(item.purchase_date), purchaseCost, totalQty, availableQty,
                item.notes || '', snipeId
              ];

              if (existingRows.length > 0) {
                await conn.execute(
                  `UPDATE toner_items SET
                    toner_code=?, toner_model=?, color=?, qty=?, critical_qty=?, unit_price=?,
                    company_id=?, company_name=?, category_id=?, category_name=?, supplier_id=?, supplier_name=?,
                    manufacturer_id=?, manufacturer_name=?, location_id=?, location_name=?, model_number=?,
                    item_no=?, order_number=?, purchase_date=?, purchase_cost=?, total_qty=?, available_qty=?,
                    notes=?, snipeit_consumable_id=?, is_active=1
                  WHERE id=?`,
                  [...params, existingRows[0].id]
                );
              } else {
                await conn.execute(
                  `INSERT INTO toner_items (
                    toner_code, toner_model, color, qty, critical_qty, unit_price,
                    company_id, company_name, category_id, category_name, supplier_id, supplier_name,
                    manufacturer_id, manufacturer_name, location_id, location_name, model_number,
                    item_no, order_number, purchase_date, purchase_cost, total_qty, available_qty,
                    notes, snipeit_consumable_id, is_active
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                  params
                );
              }
            }
          }

          await conn.commit();
          syncResults[key] = data.length;
        } catch (error) {
          await conn.rollback().catch(() => {});
          console.error(`[SnipeIT] ${key} senkronizasyon hatası:`, error.message);
          syncResults[key] = `Hata: ${error.message}`;
        }
        await delay(400);
      }

      console.log('[SnipeIT] Senkronizasyon başarıyla tamamlandı.', syncResults);
      return { success: true, results: syncResults };
    } catch (error) {
      console.error('[SnipeIT] Senkronizasyon hatası:', error.message);
      return { success: false, message: error.message };
    } finally {
      conn.release();
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
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, message: error.response?.data?.messages || error.response?.data?.message || error.message };
    }
  }

  async syncCheckedoutHistory() {
    const conn = await this.pool.getConnection();
    try {
      await this.loadSettings();
      const client = this.getClient();

      try {
        await conn.execute('ALTER TABLE toner_changes ADD COLUMN snipeit_checkout_id VARCHAR(255)');
      } catch (e) {}
      
      try {
        await conn.execute('CREATE UNIQUE INDEX idx_toner_changes_snipeit_checkout ON toner_changes (snipeit_checkout_id)');
      } catch (e) {}

      // Mükerrer temizlik
      try {
        await conn.execute(`
          DELETE FROM toner_changes 
          WHERE snipeit_checkout_id IS NOT NULL 
          AND id NOT IN (
            SELECT min_id FROM (
              SELECT MIN(id) AS min_id 
              FROM toner_changes 
              WHERE snipeit_checkout_id IS NOT NULL 
              GROUP BY snipeit_checkout_id
            ) tmp
          )
        `);
      } catch (e) {
        console.warn('[SnipeIT] Mükerrer temizlik hatası:', e.message);
      }

      const activities = await this.fetchAllPages(
        '/reports/activity?item_type=consumable&action_type=checkout&sort=created_at&order=asc',
        client
      );

      let synced = 0;
      for (const row of activities) {
        const consumableId = row.item?.id || null;
        if (!consumableId) continue;
        const checkoutId = String(row.id);
        const userId = row.target?.id || null;
        const userName = row.target?.name || row.admin?.name || null;
        const checkoutAt = row.created_at?.datetime || row.created_at?.date || null;
        const qty = Number(row.item?.qty || 1);

        const cleanNotes = row.note || null;
        const cleanDate = checkoutAt ? checkoutAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
        const timestamp = checkoutAt ? checkoutAt.slice(0, 19).replace('T', ' ') : new Date().toISOString().slice(0, 19).replace('T', ' ');

        // Find local toner item
        const [tonerRows] = await conn.execute(
          'SELECT id FROM toner_items WHERE snipeit_consumable_id = ? LIMIT 1',
          [consumableId]
        );
        if (tonerRows.length === 0) continue;

        // Try inserting safely (ignoring duplicates)
        try {
          const [result] = await conn.execute(
            `INSERT IGNORE INTO toner_changes
              (toner_id, change_date, assigned_user_id, assigned_user_name, qty, notes, snipeit_checkout_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [tonerRows[0].id, cleanDate, userId, userName, qty, cleanNotes, checkoutId, timestamp]
          );
          if (result.affectedRows > 0) synced++;
        } catch (e) {
          // Ignore unique key violations
        }
      }

      console.log(`[SnipeIT] Checkout geçmişi senkronize edildi: ${synced} yeni kayıt`);
      return { success: true, synced };
    } catch (error) {
      console.error('[SnipeIT] Checkout geçmişi sync hatası:', error.message);
      return { success: false, message: error.message };
    } finally {
      conn.release();
    }
  }
}

module.exports = SnipeITService;
