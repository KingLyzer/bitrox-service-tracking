// Mock implementation of database.js to remove better-sqlite3 dependency
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

// Fetch user data path safely
const userDataPath = app ? app.getPath('userData') : path.join(process.cwd(), 'temp_userdata');
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
}
const dbPath = path.join(userDataPath, 'servicetracker_mock.json');

console.log('[DB Mock] SQLite mock database JSON path:', dbPath);

let dbData = {};
try {
  if (fs.existsSync(dbPath)) {
    dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  }
} catch (e) {
  console.error('[DB Mock] Failed to load JSON database:', e);
}

function saveDb() {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2), 'utf8');
  } catch (e) {
    console.error('[DB Mock] Failed to save JSON database:', e);
  }
}

// Seed default settings if empty
const defaultSettings = [
  { key: 'snipeit_url', value: 'https://snipe.example.com', category: 'snipeit', label: 'Snipe-IT URL' },
  { key: 'company_name', value: 'Örnek Teknoloji A.Ş.', category: 'company', label: 'Firma Adı' },
  { key: 'currency', value: 'TL', category: 'general', label: 'Para Birimi' },
  { key: 'theme', value: 'dark', category: 'ui', label: 'Tema' },
  { key: 'ticket_prefix', value: 'SRV', category: 'tickets', label: 'Servis Fiş Öneki' },
  { key: 'stock_prefix', value: 'STK', category: 'stock', label: 'Stok Kodu Öneki' },
  { key: 'toner_prefix', value: 'TNR', category: 'toner', label: 'Toner Kodu Öneki' },
  { key: 'window_maximized', value: '1', category: 'ui', label: 'Pencere Ekranı Kapla' }
];

if (!dbData['settings']) {
  dbData['settings'] = defaultSettings;
  saveDb();
}

function parseSql(sql) {
  const cleanSql = sql.replace(/\s+/g, ' ').trim();
  
  // 1. DELETE
  if (/^DELETE FROM\s+(\w+)(?:\s+WHERE\s+(.+))?/i.test(cleanSql)) {
    const match = cleanSql.match(/^DELETE FROM\s+(\w+)(?:\s+WHERE\s+(.+))?/i);
    return {
      type: 'DELETE',
      table: match[1],
      whereClause: match[2] || ''
    };
  }
  
  // 2. INSERT
  if (/^INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i.test(cleanSql)) {
    const match = cleanSql.match(/^INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
    const table = match[1];
    const columns = match[2].split(',').map(c => c.trim().replace(/[`"]/g, ''));
    const valueExprs = match[3].split(',').map(v => v.trim());
    return {
      type: 'INSERT',
      table,
      columns,
      valueExprs
    };
  }
  
  // 3. UPDATE
  if (/^UPDATE\s+(\w+)\s+SET\s+(.+)/i.test(cleanSql)) {
    const match = cleanSql.match(/^UPDATE\s+(\w+)\s+SET\s+(.+)/i);
    const table = match[1];
    const rest = match[2];
    const whereIdx = rest.toUpperCase().lastIndexOf(' WHERE ');
    let setClause = rest;
    let whereClause = '';
    if (whereIdx !== -1) {
      setClause = rest.slice(0, whereIdx);
      whereClause = rest.slice(whereIdx + 7);
    }
    return {
      type: 'UPDATE',
      table,
      setClause,
      whereClause
    };
  }
  
  // 4. SELECT
  if (/^SELECT\s+/i.test(cleanSql)) {
    return {
      type: 'SELECT',
      rawSql: cleanSql
    };
  }
  
  return { type: 'UNKNOWN', rawSql: cleanSql };
}

function executeSelect(sql, params) {
  const cleanSql = sql.replace(/\s+/g, ' ').trim();

  // Special handler for selectByName component lookup
  if (cleanSql.includes('FROM stock_items') && cleanSql.includes('snipeit_component_id IS NULL')) {
    const name = params[0];
    const table = dbData['stock_items'] || [];
    const found = table.find(r => r.name === name && (!r.snipeit_component_id || r.snipeit_component_id === 0));
    return found ? [found] : [];
  }

  // Special handler for selectByName consumable lookup
  if (cleanSql.includes('FROM toner_items') && cleanSql.includes('snipeit_consumable_id IS NULL')) {
    const model = params[0];
    const table = dbData['toner_items'] || [];
    const found = table.find(r => r.toner_model === model && (!r.snipeit_consumable_id || r.snipeit_consumable_id === 0));
    return found ? [found] : [];
  }

  // 1. SELECT value FROM settings WHERE key='...'
  if (/FROM\s+settings\s+WHERE\s+key\s*=\s*/i.test(cleanSql)) {
    const keyMatch = cleanSql.match(/key\s*=\s*['"]?([^'"]+)['"]?/i);
    let key = keyMatch ? keyMatch[1] : null;
    if (cleanSql.includes('key = ?') || cleanSql.includes('key=?')) {
      key = params[0];
    }
    const table = dbData['settings'] || [];
    const found = table.find(r => r.key === key);
    return found ? [found] : [];
  }

  // 2. SELECT * FROM settings
  if (/SELECT\s+\*\s+FROM\s+settings/i.test(cleanSql)) {
    return dbData['settings'] || [];
  }

  // 3. JOIN query for toner_changes
  if (/FROM\s+toner_changes/i.test(cleanSql)) {
    const changes = dbData['toner_changes'] || [];
    const toners = dbData['toner_items'] || [];
    const users = dbData['cached_users'] || [];
    
    const joined = changes.map(tc => {
      const ti = toners.find(t => String(t.id) === String(tc.toner_id)) || {};
      const cu = users.find(u => String(u.id) === String(tc.assigned_user_id)) || {};
      return {
        ...tc,
        toner_model: ti.toner_model || null,
        target_name: tc.assigned_user_name || cu.name || tc.asset_name || '—'
      };
    });

    joined.sort((a, b) => {
      const dateA = a.change_date || '';
      const dateB = b.change_date || '';
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      return (Number(b.id) || 0) - (Number(a.id) || 0);
    });

    return joined;
  }

  // 4. General SELECT * FROM tableName
  const tableMatch = cleanSql.match(/FROM\s+(\w+)/i);
  if (tableMatch) {
    const table = tableMatch[1];
    let rows = dbData[table] || [];

    // Simulate Left Join category name lookup for stock items
    if (table === 'stock_items') {
      const categories = dbData['cached_categories'] || [];
      rows = rows.map(r => {
        const cat = categories.find(c => String(c.id) === String(r.category_id)) || {};
        return {
          ...r,
          category_name: r.category_name || cat.name || ''
        };
      });
    }

    // Parse simple WHERE filters
    const whereMatch = cleanSql.match(/WHERE\s+(.+?)(?:ORDER\s+BY|LIMIT|$)/i);
    if (whereMatch) {
      const whereClause = whereMatch[1].trim();
      const conditions = whereClause.split(/\s+AND\s+/i);
      let paramIdx = 0;
      
      conditions.forEach(cond => {
        if (cond.includes('LOWER(category_type) LIKE') || cond.includes('category_type LIKE')) {
          // Extract search terms like 'sarf', 'consum', 'bileş', 'component'
          const terms = [];
          const matches = cond.matchAll(/LIKE\s+['"]%([^%]+)%['"]/ig);
          for (const m of matches) {
            terms.push(m[1].toLowerCase());
          }
          if (terms.length > 0) {
            rows = rows.filter(r => {
              const type = String(r.category_type || '').toLowerCase();
              return terms.some(term => type.includes(term));
            });
          }
          return;
        }

        const condMatch = cond.match(/([\w.]+)\s*(=|LIKE|IS)\s*(.+)/i);
        if (condMatch) {
          let col = condMatch[1].trim().replace(/[`"]/g, '');
          // Strip table prefix like si. or cc.
          if (col.includes('.')) {
            col = col.split('.')[1];
          }
          const op = condMatch[2].trim().toUpperCase();
          const valExpr = condMatch[3].trim();
          
          let targetVal;
          if (valExpr === '?') {
            targetVal = params[paramIdx++];
          } else {
            targetVal = valExpr.replace(/^['"]|['"]$/g, '');
            if (targetVal === 'NULL') targetVal = null;
          }

          if (op === '=') {
            rows = rows.filter(r => {
              if (targetVal === null) return r[col] === null || r[col] === undefined;
              return String(r[col]) === String(targetVal);
            });
          } else if (op === 'IS' && targetVal === 'NULL') {
            rows = rows.filter(r => r[col] === null || r[col] === undefined || r[col] === 0);
          }
        }
      });
    }

    // Handle Ordering
    if (/ORDER\s+BY\s+([\w.]+)(?:\s+(ASC|DESC))?/i.test(cleanSql)) {
      const orderMatch = cleanSql.match(/ORDER\s+BY\s+([\w.]+)(?:\s+(ASC|DESC))?/i);
      let col = orderMatch[1];
      if (col.includes('.')) {
        col = col.split('.')[1];
      }
      const dir = (orderMatch[2] || 'ASC').toUpperCase();
      
      rows = [...rows].sort((a, b) => {
        const valA = String(a[col] || '');
        const valB = String(b[col] || '');
        const numA = Number(valA);
        const numB = Number(valB);
        if (!isNaN(numA) && !isNaN(numB)) {
          return dir === 'ASC' ? numA - numB : numB - numA;
        }
        return dir === 'ASC' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      });
    }

    return rows;
  }

  return [];
}

class Statement {
  constructor(sql) {
    this.sql = sql;
    this.parsed = parseSql(sql);
  }

  run(...params) {
    const cleanSql = this.sql.replace(/\s+/g, ' ').trim();
    const flatParams = params.flat();

    // Special handler for: INSERT OR IGNORE INTO toner_changes ... SELECT FROM toner_items
    if (this.parsed.type === 'UNKNOWN' && /INSERT\s+(?:OR\s+\w+\s+)?INTO\s+toner_changes/i.test(cleanSql)) {
      const objParams = flatParams[0] || {};
      const getVal = (key) => objParams[key] !== undefined ? objParams[key] : objParams[`:${key}`];
      
      const consumableId = getVal('consumable_id');
      const checkoutId = getVal('checkout_id');
      const userId = getVal('user_id');
      const userName = getVal('user_name');
      const qty = Number(getVal('qty') || 1);
      const notes = getVal('notes') || null;
      const checkoutAt = getVal('checkout_at') || new Date().toISOString().slice(0, 10);

      const toners = dbData['toner_items'] || [];
      const matchingToner = toners.find(t => String(t.snipeit_consumable_id) === String(consumableId));
      if (!matchingToner) {
        return { changes: 0 };
      }

      if (!dbData['toner_changes']) {
        dbData['toner_changes'] = [];
      }

      const existing = dbData['toner_changes'].find(tc => String(tc.snipeit_checkout_id) === String(checkoutId));
      if (existing) {
        return { changes: 0 };
      }

      const newRow = {
        id: dbData['toner_changes'].length ? Math.max(...dbData['toner_changes'].map(tc => Number(tc.id) || 0)) + 1 : 1,
        toner_id: matchingToner.id,
        change_date: checkoutAt,
        assigned_user_id: userId,
        assigned_user_name: userName,
        qty: qty,
        notes: notes,
        snipeit_checkout_id: checkoutId,
        created_at: checkoutAt
      };

      dbData['toner_changes'].push(newRow);
      saveDb();
      return { changes: 1 };
    }

    const { type, table, columns, valueExprs, setClause, whereClause } = this.parsed;

    if (!table) return { changes: 0 };
    if (!dbData[table]) {
      dbData[table] = [];
    }

    if (type === 'DELETE') {
      if (whereClause) {
        // Try parsing simple conditions like `col = ?` or `col=?` using flatParams
        const placeholderMatch = whereClause.match(/(\w+)\s*=\s*\?/i);
        if (placeholderMatch) {
          const col = placeholderMatch[1];
          const val = flatParams[0];
          const initialLen = dbData[table].length;
          dbData[table] = dbData[table].filter(r => String(r[col]) !== String(val));
          saveDb();
          return { changes: initialLen - dbData[table].length };
        }

        // Try parsing simple literal conditions like `col = 123` or `col = 'abc'`
        const literalMatch = whereClause.match(/(\w+)\s*=\s*['"]?([^'"]+)['"]?/i);
        if (literalMatch) {
          const col = literalMatch[1];
          const val = literalMatch[2];
          const initialLen = dbData[table].length;
          dbData[table] = dbData[table].filter(r => String(r[col]) !== String(val));
          saveDb();
          return { changes: initialLen - dbData[table].length };
        }

        return { changes: 0 };
      } else {
        dbData[table] = [];
        saveDb();
        return { changes: 1 };
      }
    }

    if (type === 'INSERT') {
      const row = {};
      let paramIdx = 0;
      columns.forEach((col, idx) => {
        const valExpr = valueExprs && valueExprs[idx] ? valueExprs[idx] : '?';
        if (valExpr === '?') {
          row[col] = flatParams[paramIdx++];
        } else {
          const cleanVal = valExpr.replace(/^['"]|['"]$/g, '');
          if (cleanVal === 'NULL') {
            row[col] = null;
          } else if (!isNaN(Number(cleanVal))) {
            row[col] = Number(cleanVal);
          } else {
            row[col] = cleanVal;
          }
        }
      });
      if (row.id === undefined || row.id === null) {
        row.id = dbData[table].length ? Math.max(...dbData[table].map(r => Number(r.id) || 0)) + 1 : 1;
      }
      const existingIdx = dbData[table].findIndex(r => String(r.id) === String(row.id) || (row.key && r.key === row.key));
      if (existingIdx !== -1) {
        dbData[table][existingIdx] = { ...dbData[table][existingIdx], ...row };
      } else {
        dbData[table].push(row);
      }
      saveDb();
      return { changes: 1, lastInsertRowid: row.id };
    }

    if (type === 'UPDATE') {
      let idToFind = null;
      const setQuestionCount = (setClause.match(/\?/g) || []).length;
      const whereParts = whereClause.split(/\s+AND\s+|\s+OR\s+/i);
      let idParamOffset = -1;
      let currentWhereQCount = 0;
      
      for (const part of whereParts) {
        if (/id\s*=\s*\?/i.test(part)) {
          idParamOffset = currentWhereQCount;
          break;
        }
        currentWhereQCount += (part.match(/\?/g) || []).length;
      }
      
      if (idParamOffset !== -1) {
        idToFind = flatParams[setQuestionCount + idParamOffset];
      }

      if (idToFind !== null) {
        const rowIdx = dbData[table].findIndex(r => String(r.id) === String(idToFind));
        if (rowIdx !== -1) {
          const assignments = setClause.split(',');
          let paramIdx = 0;
          assignments.forEach(assign => {
            const parts = assign.split('=');
            if (parts.length === 2) {
              const col = parts[0].trim().replace(/[`"]/g, '');
              const expr = parts[1].trim();
              if (expr === '?') {
                dbData[table][rowIdx][col] = flatParams[paramIdx++];
              } else if (expr.includes('qty - ?')) {
                dbData[table][rowIdx][col] = (Number(dbData[table][rowIdx][col]) || 0) - (Number(flatParams[paramIdx++]) || 0);
              } else if (expr.includes('qty + ?')) {
                dbData[table][rowIdx][col] = (Number(dbData[table][rowIdx][col]) || 0) + (Number(flatParams[paramIdx++]) || 0);
              } else if (expr.includes('available_qty')) {
                if (expr.includes('?')) {
                  dbData[table][rowIdx][col] = (Number(dbData[table][rowIdx][col]) || 0) - (Number(flatParams[paramIdx++]) || 0);
                }
              } else {
                if (expr.includes('?')) {
                  dbData[table][rowIdx][col] = flatParams[paramIdx++];
                } else {
                  const cleanVal = expr.replace(/^['"]|['"]$/g, '').trim();
                  if (cleanVal === 'NULL') {
                    dbData[table][rowIdx][col] = null;
                  } else if (cleanVal === 'CURRENT_TIMESTAMP') {
                    dbData[table][rowIdx][col] = new Date().toISOString();
                  } else if (!isNaN(Number(cleanVal))) {
                    dbData[table][rowIdx][col] = Number(cleanVal);
                  } else {
                    dbData[table][rowIdx][col] = cleanVal;
                  }
                }
              }
            }
          });
          saveDb();
          return { changes: 1 };
        }
      }
      return { changes: 0 };
    }

    return { changes: 0 };
  }

  all(...params) {
    const flatParams = params.flat();
    return executeSelect(this.sql, flatParams);
  }

  get(...params) {
    const flatParams = params.flat();
    const results = executeSelect(this.sql, flatParams);
    return results.length ? results[0] : null;
  }
}

const dummyDb = {
  prepare: (sql) => new Statement(sql),
  exec: () => {}
};

function initDatabase() {
  console.log('[DB Mock] Database initialization done.');
  return dummyDb;
}

function getDb() {
  return dummyDb;
}

function closeDb() {
  console.log('[DB Mock] Database close bypassed.');
}

function dbAll(sql, params = []) {
  console.log('[DB Mock] dbAll called with:', sql, params);
  const stmt = new Statement(sql);
  return stmt.all(params);
}

function dbGet(sql, params = []) {
  console.log('[DB Mock] dbGet called with:', sql, params);
  const stmt = new Statement(sql);
  return stmt.get(params);
}

function dbRun(sql, params = []) {
  console.log('[DB Mock] dbRun called with:', sql, params);
  const stmt = new Statement(sql);
  return stmt.run(params);
}

function dbTransaction(fn) {
  console.log('[DB Mock] dbTransaction called.');
  if (typeof fn === 'function') {
    try {
      return fn();
    } catch (e) {
      console.error('[DB Mock] dbTransaction function error:', e);
    }
  }
  return [];
}

async function flushMysqlPendingWrites(timeoutMs = 5000) {
  return { success: true, pending: 0 };
}

async function syncMysqlTables(tableNames = []) {
  return { success: true };
}

async function mergeMysqlTablesFromLocal(tableNames = []) {
  return { success: true, counts: {} };
}

function ensureLocalSyncIds(tableName) {
  return 0;
}

module.exports = {
  initDatabase,
  getDb,
  closeDb,
  dbAll,
  dbGet,
  dbRun,
  dbTransaction,
  flushMysqlPendingWrites,
  syncMysqlTables,
  mergeMysqlTablesFromLocal,
  ensureLocalSyncIds,
};
