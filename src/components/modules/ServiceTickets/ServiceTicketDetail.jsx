import React, { useState, useEffect, useCallback } from 'react';
import Modal from '../../common/Modal';
import { useAuth } from '../../../context/AuthContext';
import { useApp } from '../../../context/AppContext';

import { getApiBase, API_BASE } from '../../../utils/apiConfig';

const STATUSES = ['Yeni Kayıt', 'İncelemede', 'Parça Bekliyor', 'Onarımda', 'Testte', 'Dış Serviste', 'Tamamlandı', 'Teslim Edildi', 'Pert', 'İptal'];

const createSyncId = (prefix) => {
  if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const formatDateTime = (value) => {
  if (!value) return '';
  if (value instanceof Date) {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const dd = String(value.getDate()).padStart(2, '0');
    const hh = String(value.getHours()).padStart(2, '0');
    const min = String(value.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  }
  return String(value).slice(0, 16).replace('T', ' ');
};

export default function ServiceTicketDetail({ ticket, onClose, onUpdate, onEdit }) {
  const { user, hasPermission } = useAuth();
  const { showNotification, tableRefreshVersions, triggerTableRefresh } = useApp();
  const [operations, setOperations] = useState([]);
  const [parts, setParts] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [userList, setUserList] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showOpForm, setShowOpForm] = useState(false);
  const [showPartForm, setShowPartForm] = useState(false);
  
  const [opForm, setOpForm] = useState({ op_type: 'Genel Bakım', description: '', status_change: '' });
  const [partForm, setPartForm] = useState({ stock_id: '', part_name: '', qty: 1, unit_price: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    window.electronAPI.getUsers(true).then(res => {
      if (res?.success && Array.isArray(res.data)) {
        setUserList(res.data);
      }
    }).catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      setOperations(ticket.operations || []);
      setParts(ticket.used_parts || []);
      // Stok listesini (sadece malzeme/parça stoklarını, hurda hariç) yükle
      try {
        const stockRes = await window.electronAPI.query(
          "SELECT id, name, qty, unit_price, stock_type FROM stock_items WHERE is_active=1 AND (stock_type = 'office' OR stock_type IS NULL OR stock_type = '') ORDER BY name",
          []
        );
        if (stockRes.success && Array.isArray(stockRes.data)) {
          setStocks(stockRes.data);
        }
      } catch (e) {
        console.warn('[ServiceTicketDetail] Stok listesi yüklenemedi:', e);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [ticket]);

  useEffect(() => {
    loadData();
  }, [
    tableRefreshVersions.service_operations,
    tableRefreshVersions.used_parts,
    tableRefreshVersions.service_tickets,
    loadData
  ]);

  const saveOp = async () => {
    if (!opForm.description?.trim()) {
      showNotification('İşlem açıklaması zorunludur.', 'warning');
      return;
    }
    setSaving(true);
    try {
      // Yeni Sunucu API'si üzerinden İşlem Ekleme
      const response = await fetch(`${API_BASE}/api/islem-ekle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Fişin veri tabanındaki gerçek, benzersiz Primary Key 'id' değeri (Örn: 65)
          ticket_id: ticket.id,
          // Kullanıcının (teknisyenin) veri tabanındaki benzersiz 'id' değeri
          user_id: user.id,
          teknisyen: user.full_name || user.username || 'Bilinmeyen Teknisyen',
          op_type: opForm.op_type,
          action_type: opForm.op_type, // FIX: server.js action_type okuyor
          description: opForm.description.trim(),
          status_change: opForm.status_change || null
        })
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        showNotification('İşlem kaydı eklenemedi: ' + errText, 'danger');
        return;
      }
      
      // İşlem başarıyla eklendi, tabloları güncellemesi için onUpdate'i çağır
      onUpdate?.();

      if (opForm.status_change) {
        const isClosed = ['Tamamlandı', 'Teslim Edildi', 'Pert', 'İptal'].includes(opForm.status_change);
        
        // Yeni Sunucu API'sine PUT isteği atarak durumu güncelleme
        const statusRes = await fetch(`${API_BASE}/api/fis-guncelle/${ticket.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: opForm.status_change })
        });
        
        if (!statusRes.ok) {
          const errText = await statusRes.text().catch(() => '');
          showNotification('Servis durumu güncellenemedi: ' + errText, 'danger');
        }
      }
      setOpForm({ op_type: 'Genel Bakım', description: '', status_change: '' });
      setShowOpForm(false);
      onUpdate?.(); // Bu metot ana sayfada load()'u tetikleyecek, böylece veriler API'den yeniden gelecek.
    } catch (err) {
      showNotification('Beklenmedik hata: ' + err.message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const quickChangeStatus = async (newStatus) => {
    if (!newStatus || newStatus === ticket.status) return;
    try {
      const res = await fetch(`${API_BASE}/api/fis-guncelle/${ticket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        showNotification(`Servis durumu "${newStatus}" olarak güncellendi.`, 'success');
        ticket.status = newStatus;
        triggerTableRefresh('service_tickets');
        onUpdate?.();
      } else {
        showNotification('Durum güncellenemedi.', 'danger');
      }
    } catch (e) {
      showNotification('Hata: ' + e.message, 'danger');
    }
  };

  const savePart = async () => {
    const qty = Number(partForm.qty);
    const unitPrice = Number(partForm.unit_price);
    if (!partForm.part_name?.trim() || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      showNotification('Parça adı, pozitif miktar ve geçerli fiyat giriniz.', 'warning');
      return;
    }
    setSaving(true);
    try {
      const total = qty * unitPrice;

      if (partForm.stock_id) {
        const stockCheck = await window.electronAPI.get(
          'SELECT qty FROM stock_items WHERE id = ?',
          [Number(partForm.stock_id)]
        );
        if (!stockCheck.success || !stockCheck.data) {
          showNotification('Stok kalemi bulunamadı.', 'danger');
          return;
        }
        if (Number(stockCheck.data.qty) < qty) {
          showNotification(`Yetersiz stok. Mevcut: ${stockCheck.data.qty}`, 'warning');
          return;
        }
      }

      // YENİ MERKEZİ SUNUCU API'SI İLE PARÇA EKLEME
      const response = await fetch(`${API_BASE}/api/parca-ekle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: ticket.id,
          stock_id: partForm.stock_id || null,
          part_name: partForm.part_name.trim(),
          qty: qty,
          unit_price: unitPrice,
          total_price: total
        })
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        showNotification('Parça kullanımı eklenemedi: ' + errText, 'danger');
        return;
      }

      setShowPartForm(false);
      setPartForm({ stock_id: '', part_name: '', qty: 1, unit_price: 0 });
      onUpdate?.(); // API'den taze veri gelmesi için ana listeyi yenilet
    } catch (err) {
      showNotification('Beklenmedik hata: ' + err.message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const deletePart = async (partId) => {
    if (!window.confirm('Bu parçayı silmek istediğinize emin misiniz?')) return;
    try {
      const response = await fetch(`${API_BASE}/api/parca-sil/${partId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        showNotification('Parça silindi.', 'success');
        onUpdate?.();
      } else {
        const errText = await response.text().catch(() => '');
        showNotification('Silme işlemi başarısız: ' + errText, 'danger');
      }
    } catch (err) {
      showNotification('Silme hatası: ' + err.message, 'danger');
    }
  };

  const InfoRow = ({ label, value }) => {
    const iconMap = {
      'Fiş No': '🎫',
      'Durum': '🔄',
      'Öncelik': '⚡',
      'Asset Tag': '🏷️',
      'Cihaz': '💻',
      'Cihaz / Model': '💻',
      'Seri Numarası': '🔢',
      'Kullanıcı': '👤',
      'Lokasyon': '🏢',
      'Kayıt Tarihi': '📅',
      'İşletim Sistemi': '🖥️',
      'Lisans Bilgisi': '🔑',
      'Marka / Model': '⚙️',
      'Ait Kişi': '👤',
      'MAC Adresi': '🌐',
      'Envanter': '🏷️'
    };
    const icon = iconMap[label] || '▫️';
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--color-border)', fontSize: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: 11.5, minWidth: 125 }}>
          <span style={{ fontSize: 13 }}>{icon}</span>
          <span>{label}</span>
        </div>
        <div style={{ fontWeight: 600, color: 'var(--color-text)', textAlign: 'right', wordBreak: 'break-word' }}>
          {value || <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>—</span>}
        </div>
      </div>
    );
  };

  const resolveTechDisplayName = (rawTech, userId) => {
    if (!rawTech && !userId) return '—';
    const cleanRaw = String(rawTech || '').trim().toLowerCase();
    const matched = userList.find(u =>
      (userId && Number(u.id) === Number(userId)) ||
      (u.full_name && cleanRaw && u.full_name.trim().toLowerCase() === cleanRaw) ||
      (u.username && cleanRaw && u.username.trim().toLowerCase() === cleanRaw)
    );
    if (matched && matched.manager_name) {
      return matched.manager_name;
    }
    return rawTech || matched?.full_name || '—';
  };

  const buildPrintHtml = () => {
    const rows = [
      ['Fiş No', ticket.ticket_no],
      ['Durum', ticket.status],
      ['Öncelik', ticket.priority],
      ['Kayıt Tarihi', formatDateTime(ticket.created_at)],
      ['Asset / Barkod', ticket.asset_tag],
      ['Cihaz Tanımı', ticket.asset_name || ticket.model_name],
      ['Marka / Model', ticket.model_name],
      ['Seri No', ticket.serial_no],
      ['Zimmetli Personel', ticket.user_name],
      ['Lokasyon / Birim', ticket.location_name],
    ].map(([label, value]) => `
      <tr>
        <th>${escapeHtml(label)}</th>
        <td>${escapeHtml(value || '—')}</td>
      </tr>
    `).join('');

    const opRows = operations.length
      ? operations.map(op => {
          const techName = resolveTechDisplayName(op.tech_name || op.teknisyen, op.user_id);
          return `
            <tr>
              <td style="white-space: nowrap; font-weight: 500;">${escapeHtml(formatDateTime(op.op_date))}</td>
              <td>
                <div style="font-weight: 700; color: #0f172a; margin-bottom: 2px;">${escapeHtml(op.op_type || 'İşlem')}</div>
                <div style="color: #334155; line-height: 1.4;">${escapeHtml(op.description || '-')}</div>
                ${op.status_change ? `<div style="margin-top: 4px; font-size: 10px; color: #2563eb; font-weight: 600;">Sonuç Durumu: ${escapeHtml(op.status_change)}</div>` : ''}
              </td>
              <td style="font-weight: 600; color: #0f172a;">${escapeHtml(techName)}</td>
            </tr>
          `;
        }).join('')
      : '<tr><td colspan="3" class="muted" style="padding: 14px; text-align: center; color: #64748b;">Kayıtlı işlem geçmişi bulunmamaktadır.</td></tr>';

    const partRows = parts.length
      ? parts.map((part, index) => `
        <tr>
          <td style="text-align: center; width: 40px; color: #64748b; font-weight: 600;">${index + 1}</td>
          <td style="font-weight: 600; color: #0f172a;">${escapeHtml(part.part_name)}</td>
          <td style="text-align: center; width: 120px; font-weight: 600; color: #0f172a;">${escapeHtml(part.qty || 1)} Adet</td>
        </tr>
      `).join('')
      : '<tr><td colspan="3" class="muted" style="padding: 14px; text-align: center; color: #64748b;">Kullanılan yedek parça veya malzeme bulunmamaktadır.</td></tr>';

    const lastOp = operations[operations.length - 1];
    const responsibleTech = lastOp 
      ? resolveTechDisplayName(lastOp.tech_name || lastOp.teknisyen, lastOp.user_id) 
      : (ticket.teknisyen ? resolveTechDisplayName(ticket.teknisyen) : 'Yetkili Teknisyen');

    return `<!doctype html>
      <html lang="tr">
        <head>
          <meta charset="utf-8" />
          <title>Servis Formu - ${escapeHtml(ticket.ticket_no || '')}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm 15mm;
            }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 0;
              background: #fff;
              color: #0f172a;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              font-size: 11px;
              line-height: 1.45;
            }
            .header-wrap {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 12px;
              margin-bottom: 14px;
            }
            .brand-box h1 {
              margin: 0;
              font-size: 18px;
              font-weight: 800;
              color: #0f172a;
              letter-spacing: -0.3px;
              text-transform: uppercase;
            }
            .brand-box .sub {
              margin-top: 3px;
              font-size: 10.5px;
              color: #475569;
              font-weight: 600;
              letter-spacing: 0.4px;
              text-transform: uppercase;
            }
            .ticket-badge {
              border: 1.5px solid #0f172a;
              border-radius: 6px;
              padding: 6px 14px;
              text-align: right;
              background: #f8fafc;
            }
            .ticket-badge .lbl {
              font-size: 9px;
              font-weight: 700;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .ticket-badge .val {
              font-size: 15px;
              font-weight: 800;
              color: #0f172a;
              font-family: monospace, sans-serif;
            }
            .grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
              margin-bottom: 12px;
            }
            .card {
              border: 1px solid #cbd5e1;
              border-radius: 5px;
              overflow: hidden;
              background: #fff;
            }
            .card-header {
              background: #f1f5f9;
              color: #0f172a;
              font-size: 10.5px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.4px;
              padding: 6px 10px;
              border-bottom: 1px solid #cbd5e1;
            }
            .card-body {
              padding: 8px 10px;
            }
            table.info-table {
              width: 100%;
              border-collapse: collapse;
            }
            table.info-table th, table.info-table td {
              padding: 4px 6px;
              border-bottom: 1px solid #e2e8f0;
              font-size: 10.5px;
            }
            table.info-table tr:last-child th, table.info-table tr:last-child td {
              border-bottom: none;
            }
            table.info-table th {
              width: 38%;
              color: #475569;
              font-weight: 600;
              background: #f8fafc;
              text-align: left;
            }
            table.info-table td {
              color: #0f172a;
              font-weight: 500;
            }
            .desc-text {
              white-space: pre-wrap;
              font-size: 11px;
              line-height: 1.45;
              color: #1e293b;
              min-height: 45px;
            }
            .notes-wrap {
              margin-top: 8px;
              padding-top: 6px;
              border-top: 1px dashed #cbd5e1;
              font-size: 10.5px;
              color: #334155;
            }
            .section-box {
              border: 1px solid #cbd5e1;
              border-radius: 5px;
              overflow: hidden;
              margin-bottom: 12px;
            }
            table.data-table {
              width: 100%;
              border-collapse: collapse;
            }
            table.data-table th {
              background: #f1f5f9;
              color: #334155;
              font-size: 10px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.4px;
              padding: 6px 8px;
              border-bottom: 1px solid #cbd5e1;
              text-align: left;
            }
            table.data-table td {
              padding: 6px 8px;
              border-bottom: 1px solid #e2e8f0;
              font-size: 10.5px;
              vertical-align: top;
            }
            table.data-table tr:last-child td {
              border-bottom: none;
            }
            table.data-table tr:nth-child(even) td {
              background: #fafafa;
            }
            .signatures-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 16px;
              margin-top: 20px;
              page-break-inside: avoid;
            }
            .sig-card {
              border: 1px solid #cbd5e1;
              border-radius: 5px;
              padding: 10px 12px;
              background: #fff;
            }
            .sig-card .head {
              font-size: 10.5px;
              font-weight: 700;
              text-transform: uppercase;
              color: #0f172a;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 4px;
              margin-bottom: 6px;
            }
            .sig-card .name {
              font-size: 11px;
              font-weight: 600;
              color: #1e293b;
              margin-bottom: 30px;
            }
            .sig-line {
              border-top: 1px solid #94a3b8;
              padding-top: 3px;
              display: flex;
              justify-content: space-between;
              font-size: 9.5px;
              color: #64748b;
            }
            .footer-info {
              margin-top: 14px;
              padding-top: 6px;
              border-top: 1px solid #e2e8f0;
              display: flex;
              justify-content: space-between;
              font-size: 9px;
              color: #94a3b8;
            }
          </style>
        </head>
        <body>
          <div class="header-wrap">
            <div class="brand-box">
              <h1>TEKNİK SERVİS & BAKIM FORMU</h1>
              <div class="sub">BİLGİ TEKNOLOJİLERİ SERVİS YÖNETİM SİSTEMİ</div>
            </div>
            <div class="ticket-badge">
              <div class="lbl">Fiş Numarası</div>
              <div class="val">${escapeHtml(ticket.ticket_no || '-')}</div>
            </div>
          </div>

          <div class="grid">
            <div class="card">
              <div class="card-header">📋 Servis & Cihaz Özeti</div>
              <table class="info-table"><tbody>${rows}</tbody></table>
            </div>
            <div class="card">
              <div class="card-header">🔧 Bildirilen Arıza / Şikayet</div>
              <div class="card-body">
                <div class="desc-text">${escapeHtml(ticket.fault_desc || '-')}</div>
                ${ticket.notes ? `
                  <div class="notes-wrap">
                    <strong style="color: #0f172a;">Teknik Notlar:</strong>
                    <div style="margin-top: 2px; line-height: 1.4;">${escapeHtml(ticket.notes)}</div>
                  </div>
                ` : ''}
              </div>
            </div>
          </div>

          <div class="section-box">
            <div class="card-header">🛠️ Gerçekleştirilen İşlemler</div>
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width: 130px;">Tarih / Saat</th>
                  <th>Yapılan İşlem & Açıklama</th>
                  <th style="width: 170px;">Yetkili Teknisyen</th>
                </tr>
              </thead>
              <tbody>${opRows}</tbody>
            </table>
          </div>

          <div class="section-box">
            <div class="card-header">📦 Kullanılan / Değişen Parçalar</div>
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width: 40px; text-align: center;">#</th>
                  <th>Parça / Malzeme Tanımı</th>
                  <th style="width: 120px; text-align: center;">Miktar</th>
                </tr>
              </thead>
              <tbody>${partRows}</tbody>
            </table>
          </div>

          <div class="signatures-grid">
            <div class="sig-card">
              <div class="head">Servisi Yapan / Teknisyen</div>
              <div class="name">Yetkili: <strong>${escapeHtml(responsibleTech)}</strong></div>
              <div class="sig-line">
                <span>İmza:</span>
                <span>Tarih: ${escapeHtml(formatDateTime(new Date()).slice(0, 10))}</span>
              </div>
            </div>
            <div class="sig-card">
              <div class="head">Cihazı Teslim Alan / Personel</div>
              <div class="name">Ad Soyad: <strong>${escapeHtml(ticket.user_name || '—')}</strong></div>
              <div class="sig-line">
                <span>İmza:</span>
                <span>Tarih: ${escapeHtml(formatDateTime(new Date()).slice(0, 10))}</span>
              </div>
            </div>
          </div>

          <div class="footer-info">
            <span>Created by Bitrox</span>
            <span>Belge Basım Tarihi: ${escapeHtml(formatDateTime(new Date()))}</span>
          </div>
        </body>
      </html>`;
  };

  const handlePrint = async () => {
    const res = await window.electronAPI.printHtml(buildPrintHtml());
    if (!res?.success) {
      showNotification('Yazdırma başarısız: ' + (res?.message || 'Bilinmeyen hata'), 'danger');
    }
  };

  const statusConfig = {
    'Yeni Kayıt':      { bg: 'rgba(14, 165, 233, 0.12)', color: '#38bdf8', border: 'rgba(14, 165, 233, 0.35)', dot: '#0ea5e9', icon: '🆕' },
    'İncelemede':     { bg: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24', border: 'rgba(245, 158, 11, 0.35)', dot: '#f59e0b', icon: '🔍' },
    'Parça Bekliyor': { bg: 'rgba(249, 115, 22, 0.12)', color: '#fb923c', border: 'rgba(249, 115, 22, 0.35)', dot: '#ea580c', icon: '⏳' },
    'Onarımda':       { bg: 'rgba(168, 85, 247, 0.12)', color: '#c084fc', border: 'rgba(168, 85, 247, 0.35)', dot: '#a855f7', icon: '⚙️' },
    'Testte':         { bg: 'rgba(20, 184, 166, 0.12)', color: '#2dd4bf', border: 'rgba(20, 184, 166, 0.35)', dot: '#14b8a6', icon: '🧪' },
    'Dış Serviste':   { bg: 'rgba(99, 102, 241, 0.12)', color: '#818cf8', border: 'rgba(99, 102, 241, 0.35)', dot: '#6366f1', icon: '🚚' },
    'Tamamlandı':     { bg: 'rgba(16, 185, 129, 0.12)', color: '#34d399', border: 'rgba(16, 185, 129, 0.35)', dot: '#10b981', icon: '✅' },
    'Teslim Edildi':  { bg: 'rgba(34, 197, 94, 0.12)',  color: '#4ade80', border: 'rgba(34, 197, 94, 0.35)',  dot: '#22c55e', icon: '🤝' },
    'Pert':           { bg: 'rgba(239, 68, 68, 0.15)',  color: '#f87171', border: 'rgba(239, 68, 68, 0.35)', dot: '#ef4444', icon: '💥' },
    'İptal':          { bg: 'rgba(100, 116, 139, 0.12)', color: '#94a3b8', border: 'rgba(100, 116, 139, 0.3)', dot: '#64748b', icon: '✖️' },
  };
  const sCfg = statusConfig[ticket.status] || { bg: 'rgba(148, 163, 184, 0.12)', color: '#94a3b8', border: 'rgba(148, 163, 184, 0.3)', dot: '#94a3b8', icon: '📋' };

  const prioMap = {
    'Acil':   { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: 'rgba(239, 68, 68, 0.35)', icon: '🔥' },
    'Kritik': { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: 'rgba(239, 68, 68, 0.35)', icon: '🔥' },
    'Yüksek': { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: 'rgba(245, 158, 11, 0.35)', icon: '⚡' },
    'Normal': { bg: 'rgba(14, 165, 233, 0.12)', color: '#38bdf8', border: 'rgba(14, 165, 233, 0.25)', icon: '🔹' },
    'Düşük':  { bg: 'rgba(100, 116, 139, 0.12)', color: '#94a3b8', border: 'rgba(100, 116, 139, 0.2)', icon: '▫️' }
  };
  const pCfg = prioMap[ticket.priority] || prioMap['Normal'];

  const getOpBadgeStyle = (type) => {
    switch (type) {
      case 'Genel Bakım': return { bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.3)', color: '#60a5fa', icon: '🧰' };
      case 'Parça Değişimi': return { bg: 'rgba(249, 115, 22, 0.12)', border: 'rgba(249, 115, 22, 0.3)', color: '#fb923c', icon: '🔩' };
      case 'Yazılım İşlemi': return { bg: 'rgba(168, 85, 247, 0.12)', border: 'rgba(168, 85, 247, 0.3)', color: '#c084fc', icon: '💻' };
      case 'Test': return { bg: 'rgba(20, 184, 166, 0.12)', border: 'rgba(20, 184, 166, 0.3)', color: '#2dd4bf', icon: '🧪' };
      default: return { bg: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.3)', color: '#94a3b8', icon: '📝' };
    }
  };

  const totalPartsCost = parts.reduce((sum, p) => sum + (Number(p.total_price) || (Number(p.qty || 1) * Number(p.unit_price || 0))), 0);

  const calculateDuration = () => {
    if (!ticket?.created_at) return null;
    const start = new Date(ticket.created_at);
    const end = ticket.status === 'Teslim Edildi' && ticket.delivery_date ? new Date(ticket.delivery_date) : new Date();
    const diffMs = Math.max(0, end - start);
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (diffDays === 0) return `${diffHours} Saat`;
    return `${diffDays} Gün ${diffHours} Sa`;
  };

  const resolvedModelDisplay = (ticket.model_name && ticket.model_name !== ticket.asset_tag)
    ? ticket.model_name
    : (ticket.asset_name && ticket.asset_name !== ticket.asset_tag)
      ? ticket.asset_name
      : ticket.model_name || ticket.asset_name || '—';

  return (
    <div style={{ padding: '0 12px 24px', position: 'relative' }}>
      {/* Üst Aksiyon & Özet Başlık Çubuğu */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 16,
        paddingBottom: 14,
        borderBottom: '1px solid var(--color-border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 16,
            fontWeight: 800,
            fontFamily: 'monospace',
            color: 'var(--color-primary-light, #60a5fa)',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <span>🎫</span>
            <span>{ticket.ticket_no}</span>
          </span>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 10px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            background: sCfg.bg,
            border: `1px solid ${sCfg.border}`,
            color: sCfg.color
          }}>
            <span style={{ fontSize: 11 }}>{sCfg.icon}</span>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: sCfg.dot }} />
            <span>{ticket.status}</span>
          </span>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 8px',
            borderRadius: 6,
            fontSize: 11.5,
            fontWeight: 600,
            background: pCfg.bg,
            border: `1px solid ${pCfg.border}`,
            color: pCfg.color
          }}>
            <span style={{ fontSize: 12 }}>{pCfg.icon}</span>
            <span>{ticket.priority || 'Normal'}</span>
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button 
            className="btn btn-secondary" 
            onClick={handlePrint}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}
          >
            <span>🖨️</span>
            <span>Yazdır / PDF</span>
          </button>
          {hasPermission('service', 'can_edit') && (
            <button 
              className="btn btn-primary" 
              onClick={onEdit}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}
            >
              <span>✏️</span>
              <span>Düzenle</span>
            </button>
          )}
        </div>
      </div>

      {/* İki Kolonlu Bilgi Kartları: Cihaz/Özet & Arıza/Kurulum Detayı */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 18 }}>
        {/* Sol Üst: Cihaz ve Kullanıcı Özeti */}
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 10,
          padding: 16,
          boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
        }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 12px', color: 'var(--color-primary-light, #60a5fa)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>📋</span>
            <span>Cihaz ve Kullanıcı Özeti</span>
          </h4>
          <InfoRow label="Fiş No" value={ticket.ticket_no} />
          <InfoRow label="Asset Tag" value={ticket.asset_tag} />
          <InfoRow label="Cihaz / Model" value={resolvedModelDisplay} />
          {ticket.category_name && <InfoRow label="Kategori" value={ticket.category_name} />}
          <InfoRow label="Seri Numarası" value={ticket.serial_no} />
          <InfoRow label="Kullanıcı" value={ticket.user_name} />
          <InfoRow label="Lokasyon" value={ticket.location_name} />
          <InfoRow label="Kayıt Tarihi" value={formatDateTime(ticket.created_at)} />
        </div>

        {/* Sağ Üst: Arıza, Süreç ve Hızlı Durum Kartı */}
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 10,
          padding: 16,
          boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 12
        }}>
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 12px', color: 'var(--color-primary-light, #60a5fa)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🔧</span>
              <span>Arıza ve Servis Değerlendirmesi</span>
            </h4>

            {ticket.record_type === 'installation' ? (
              <>
                <InfoRow label="İşletim Sistemi" value={ticket.os_name} />
                <InfoRow label="Lisans Bilgisi" value={ticket.os_license} />
                <InfoRow label="MAC Adresi" value={ticket.mac_address} />
                {ticket.fault_desc && (
                  <div style={{ marginTop: 10, padding: 10, borderRadius: 6, background: 'rgba(59, 130, 246, 0.08)', borderLeft: '3px solid #3b82f6', fontSize: 12 }}>
                    <strong style={{ color: '#38bdf8' }}>Kurulum Notları:</strong> {ticket.fault_desc}
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  borderLeft: '4px solid #ef4444',
                  padding: '10px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: 'var(--color-text)',
                  marginBottom: 10
                }}>
                  <div style={{ fontWeight: 700, color: '#ef4444', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span>⚠️</span>
                    <span>Bildirilen Arıza / Şikayet:</span>
                  </div>
                  <div style={{ fontWeight: 500 }}>{ticket.fault_desc || 'Arıza detayı belirtilmemiş.'}</div>
                </div>

                {ticket.notes && (
                  <div style={{
                    background: 'rgba(59, 130, 246, 0.08)',
                    borderLeft: '4px solid #3b82f6',
                    padding: '10px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                    lineHeight: 1.5,
                    color: 'var(--color-text)',
                    marginBottom: 10
                  }}>
                    <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span>📝</span>
                      <span>Teknik Notlar / Ön Tespitler:</span>
                    </div>
                    <div>{ticket.notes}</div>
                  </div>
                )}
              </>
            )}

            {/* Kompakt Süre & İstatistik Şeridi */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              background: 'var(--color-surface-alt)',
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              fontSize: 11.5,
              marginTop: 6
            }}>
              <div>
                <span style={{ color: 'var(--color-text-secondary)', display: 'block', fontSize: 10.5, fontWeight: 600 }}>HEDEF TESLİM</span>
                <strong style={{ color: 'var(--color-text)' }}>
                  📅 {ticket.delivery_date ? formatDateTime(ticket.delivery_date).slice(0, 10) : 'Belirlenmedi'}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-secondary)', display: 'block', fontSize: 10.5, fontWeight: 600 }}>SERVİSTE GEÇEN SÜRE</span>
                <strong style={{ color: ticket.status === 'Teslim Edildi' ? '#10b981' : '#f59e0b' }}>
                  ⏱️ {calculateDuration() || '—'}
                </strong>
              </div>
            </div>
          </div>

          {/* Hızlı Durum Değiştirme Butonları */}
          {hasPermission('service', 'can_edit') && (
            <div style={{
              paddingTop: 8,
              borderTop: '1px dashed var(--color-border)'
            }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                ⚡ Hızlı Durum Güncelle
              </span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['İncelemede', 'Onarımda', 'Testte', 'Dış Serviste', 'Teslim Edildi'].map(st => {
                  const isCurrent = ticket.status === st;
                  const cfg = statusConfig[st] || {};
                  return (
                    <button
                      key={st}
                      type="button"
                      disabled={isCurrent}
                      onClick={() => quickChangeStatus(st)}
                      style={{
                        padding: '4px 9px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: isCurrent ? 'default' : 'pointer',
                        background: isCurrent ? cfg.bg : 'var(--color-surface-alt)',
                        border: `1px solid ${isCurrent ? cfg.border : 'var(--color-border)'}`,
                        color: isCurrent ? cfg.color : 'var(--color-text-secondary)',
                        opacity: isCurrent ? 1 : 0.8,
                        transition: 'all 0.15s ease'
                      }}
                      title={isCurrent ? 'Şu anki durum' : `Durumu "${st}" yap`}
                    >
                      {cfg.icon} {st}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* İki Kolonlu Liste: İşlem Geçmişi (Timeline) & Kullanılan Parçalar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {/* Sol Alt: İşlem Geçmişi (Modern Timeline) */}
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 10,
          overflow: 'hidden',
          boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 14px',
            background: 'var(--color-surface-alt)',
            borderBottom: '1px solid var(--color-border)'
          }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>📝</span>
              <span>İşlem Geçmişi</span>
              <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 500 }}>({operations.length})</span>
            </span>
            {hasPermission('service', 'can_edit') && (
              <button 
                className="btn btn-sm btn-primary" 
                onClick={() => setShowOpForm(true)}
                style={{ padding: '4px 10px', fontSize: 11, borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <span>➕</span>
                <span>İşlem Ekle</span>
              </button>
            )}
          </div>

          <div style={{ flex: 1, maxHeight: 360, overflowY: 'auto', padding: '14px 16px' }}>
            {operations.length === 0 ? (
              <div style={{ padding: 36, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>
                <span style={{ fontSize: 28, display: 'block', marginBottom: 8, opacity: 0.6 }}>📝</span>
                <div style={{ fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>İşlem Kaydı Bulunmuyor</div>
                <div>Bu servis için henüz bir teknik işlem girilmedi.</div>
                {hasPermission('service', 'can_edit') && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    onClick={() => setShowOpForm(true)}
                    style={{ marginTop: 12, padding: '4px 12px', borderRadius: 6 }}
                  >
                    ➕ İlk İşlemi Ekle
                  </button>
                )}
              </div>
            ) : (
              <div style={{ position: 'relative', paddingLeft: 18 }}>
                {/* Dikey Zaman Çizgisi */}
                <div style={{
                  position: 'absolute',
                  left: 6,
                  top: 6,
                  bottom: 6,
                  width: 2,
                  background: 'var(--color-border)',
                  borderRadius: 2
                }} />

                {operations.map((op, idx) => {
                  const opStyle = getOpBadgeStyle(op.op_type);
                  return (
                    <div key={op.id || idx} style={{ position: 'relative', marginBottom: 14 }}>
                      {/* Sol Timeline Noktası */}
                      <div style={{
                        position: 'absolute',
                        left: -18,
                        top: 4,
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: opStyle.color,
                        border: '3px solid var(--color-surface)',
                        boxShadow: `0 0 0 1px ${opStyle.border}`
                      }} />

                      {/* Başlık: Tür, Teknisyen & Tarih */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '1px 7px',
                            borderRadius: 6,
                            fontSize: 10.5,
                            fontWeight: 700,
                            background: opStyle.bg,
                            border: `1px solid ${opStyle.border}`,
                            color: opStyle.color
                          }}>
                            <span>{opStyle.icon}</span>
                            <span>{op.op_type}</span>
                          </span>
                          <span style={{
                            fontSize: 11,
                            color: 'var(--color-text)',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}>
                            <span>👨‍🔧</span>
                            <span>{op.tech_name || op.teknisyen || 'Teknisyen'}</span>
                          </span>
                        </div>
                        <span style={{ fontSize: 10.5, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                          🕒 {formatDateTime(op.op_date || op.created_at)}
                        </span>
                      </div>

                      {/* Açıklama Balonu */}
                      <div style={{
                        background: 'var(--color-surface-alt)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 8,
                        padding: '8px 12px',
                        fontSize: 12,
                        lineHeight: 1.45,
                        color: 'var(--color-text)'
                      }}>
                        {op.description}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sağ Alt: Kullanılan Parçalar */}
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 10,
          overflow: 'hidden',
          boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 14px',
            background: 'var(--color-surface-alt)',
            borderBottom: '1px solid var(--color-border)'
          }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>📦</span>
              <span>Kullanılan Parçalar</span>
              <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 500 }}>({parts.length})</span>
            </span>
            {hasPermission('service', 'can_edit') && (
              <button 
                className="btn btn-sm btn-primary" 
                onClick={() => setShowPartForm(true)}
                style={{ padding: '4px 10px', fontSize: 11, borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <span>➕</span>
                <span>Parça Ekle</span>
              </button>
            )}
          </div>

          <div style={{ flex: 1, maxHeight: 360, overflowY: 'auto' }}>
            {parts.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>
                <span style={{ fontSize: 28, display: 'block', marginBottom: 8, opacity: 0.6 }}>🔩</span>
                <div style={{ fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Kullanılan Parça Yok</div>
                <div>Bu servis kaydında henüz yedek parça veya malzeme sarfiyatı yapılmadı.</div>
                {hasPermission('service', 'can_edit') && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    onClick={() => setShowPartForm(true)}
                    style={{ marginTop: 12, padding: '4px 12px', borderRadius: 6 }}
                  >
                    ➕ İlk Parçayı Ekle
                  </button>
                )}
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                <thead>
                  <tr style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>Parça Tanımı</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, width: 80 }}>Adet</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, width: 90 }}>Tutar</th>
                    <th style={{ padding: '8px 10px', width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {parts.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--color-text)' }}>
                        <span style={{ marginRight: 6 }}>🔩</span>
                        <span>{p.part_name}</span>
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          background: 'rgba(59, 130, 246, 0.12)',
                          color: '#60a5fa',
                          border: '1px solid rgba(59, 130, 246, 0.3)'
                        }}>
                          {p.qty} Adet
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--color-text)' }}>
                        {Number(p.total_price || (p.qty * p.unit_price) || 0).toFixed(2)} ₺
                      </td>
                      <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                        {hasPermission('service', 'can_delete') && (
                          <button
                            className="btn btn-sm"
                            title="Parçayı Sil"
                            style={{
                              width: 26,
                              height: 26,
                              padding: 0,
                              borderRadius: 6,
                              background: 'rgba(239, 68, 68, 0.12)',
                              border: '1px solid rgba(239, 68, 68, 0.35)',
                              color: '#f87171',
                              cursor: 'pointer'
                            }}
                            onClick={() => deletePart(p.id)}
                          >
                            🗑️
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {parts.length > 0 && (
            <div style={{
              padding: '8px 14px',
              background: 'var(--color-surface-alt)',
              borderTop: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 12
            }}>
              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Toplam Parça Maliyeti:</span>
              <strong style={{ color: '#10b981', fontSize: 13 }}>₺{totalPartsCost.toFixed(2)}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Modallar */}
      {showOpForm && (
        <Modal isOpen title="Yeni İşlem Kaydı Ekle" size="md" onClose={() => setShowOpForm(false)}>
          <div style={{ padding: 16 }}>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4, display: 'block' }}>İşlem Türü</label>
              <select className="form-control" value={opForm.op_type} onChange={e => setOpForm({...opForm, op_type: e.target.value})}>
                <option>Genel Bakım</option><option>Parça Değişimi</option><option>Yazılım İşlemi</option><option>Test</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4, display: 'block' }}>Servis Durumunu Güncelle (Opsiyonel)</label>
              <select className="form-control" value={opForm.status_change} onChange={e => setOpForm({...opForm, status_change: e.target.value})}>
                <option value="">— Değiştirme (Mevcut Durum Kalsın) —</option>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4, display: 'block' }}>Yapılan İşlem Açıklaması *</label>
              <textarea className="form-control" value={opForm.description} onChange={e => setOpForm({...opForm, description: e.target.value})} rows={3} placeholder="Yapılan teknik müdahaleyi detaylandırın..." />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowOpForm(false)}>Vazgeç</button>
              <button className="btn btn-primary" onClick={saveOp} disabled={saving} style={{ minWidth: 100 }}>
                {saving ? 'Kaydediliyor...' : '💾 İşlemi Kaydet'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showPartForm && (
        <Modal isOpen title="Yedek Parça / Malzeme Kullanımı Ekle" size="md" onClose={() => setShowPartForm(false)}>
          <div style={{ padding: 16 }}>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4, display: 'block' }}>Stoktan Seç</label>
              <select className="form-control" value={partForm.stock_id} onChange={e => {
                const s = stocks.find(x => String(x.id) === String(e.target.value));
                setPartForm({...partForm, stock_id: e.target.value, part_name: s?.name || '', unit_price: s?.unit_price || 0});
              }}>
                <option value="">— Elle Parça Gir —</option>
                {stocks
                  .filter(s => {
                    const st = String(s.stock_type || '').toLowerCase();
                    return st !== 'scrap' && st !== 'hurda';
                  })
                  .map(s => <option key={s.id} value={s.id}>{s.name} (Stok: {s.qty})</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4, display: 'block' }}>Parça Tanımı *</label>
              <input className="form-control" value={partForm.part_name} onChange={e => setPartForm({...partForm, part_name: e.target.value})} placeholder="Örn: 512GB NVMe SSD" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div className="form-group">
                <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4, display: 'block' }}>Miktar *</label>
                <input className="form-control" type="number" min="1" value={partForm.qty} onChange={e => setPartForm({...partForm, qty: e.target.value})} />
              </div>
              <div className="form-group">
                <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4, display: 'block' }}>Birim Fiyat (₺)</label>
                <input className="form-control" type="number" min="0" step="0.01" value={partForm.unit_price} onChange={e => setPartForm({...partForm, unit_price: e.target.value})} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowPartForm(false)}>Vazgeç</button>
              <button className="btn btn-primary" onClick={savePart} disabled={saving} style={{ minWidth: 100 }}>
                {saving ? 'Ekleniyor...' : '➕ Parçayı Ekle'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
