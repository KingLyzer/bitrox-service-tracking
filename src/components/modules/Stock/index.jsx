import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { useAuth } from '../../../context/AuthContext';
import { useApp } from '../../../context/AppContext';
import Modal from '../../common/Modal';
import ConfirmDialog from '../../common/ConfirmDialog';
import { apiGet, apiPost, apiPut } from '../../../utils/apiFetch';

const EMPTY_FORM = {
  id: null,
  stock_code: '',
  barcode: '',
  name: '',
  category_id: '',
  category_name: '',
  stock_type: 'office',
  qty: 0,
  unit: 'Adet',
  critical_qty: 0,
  unit_price: '',
  location: '',
  description: '',
};

const UNITS = ['Adet', 'Paket', 'Kutu', 'Metre', 'Kilogram', 'Litre', 'Rulo', 'Set'];

async function ensureSchema() {
  try {
    const res = await apiPost('/api/stock/ensure-schema', {});
    return res.success;
  } catch (err) {
    console.warn('[Stock şema kontrolü]', err);
    return false;
  }
}

export default function Stock({ tabData }) {
  const { user, hasPermission, auditLog } = useAuth();
  const { showNotification, theme, refreshToggle, tableRefreshVersions = {}, triggerRefresh, openTab } = useApp();
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem('cached_stock_items');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [categories, setCategories] = useState(() => {
    try {
      const saved = localStorage.getItem('cached_stock_categories');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [users, setUsers] = useState(() => {
    try {
      const saved = localStorage.getItem('cached_snipeit_users');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [adjustTarget, setAdjustTarget] = useState(null);
  const [adjustQty, setAdjustQty] = useState('1');
  const [adjustType, setAdjustType] = useState('add');
  const [adjustNote, setAdjustNote] = useState('');

  const [checkout, setCheckout] = useState(null);
  const [scanValue, setScanValue] = useState('');
  const [chkUser, setChkUser] = useState('');
  const [chkQty, setChkQty] = useState('1');
  const [chkNote, setChkNote] = useState('');
  const scanRef = useRef(null);

  const [labelTarget, setLabelTarget] = useState(null);
  const [labelMode, setLabelMode] = useState('barcode');

  const [movementsFor, setMovementsFor] = useState(null);
  const [movements, setMovements] = useState([]);
  const [movLoading, setMovLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [confirmDeleteSelected, setConfirmDeleteSelected] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [stockTypeFilter, setStockTypeFilter] = useState('all'); // 'all' | 'office' | 'scrap'
  const [filterCriticalOnly, setFilterCriticalOnly] = useState(() => Boolean(tabData?.onlyCritical || tabData?.filter === 'critical'));

  useEffect(() => {
    const handlePresetEvent = (e) => {
      if (e.detail?.targetTab === 'stock' && (e.detail?.onlyCritical || e.detail?.filter === 'critical')) {
        setFilterCriticalOnly(true);
      }
    };
    window.addEventListener('service-tracker-preset', handlePresetEvent);
    return () => window.removeEventListener('service-tracker-preset', handlePresetEvent);
  }, []);

  useEffect(() => {
    if (tabData?.onlyCritical || tabData?.filter === 'critical') {
      setFilterCriticalOnly(true);
    }
  }, [tabData?.onlyCritical, tabData?.timestamp, tabData]);
  const [selectedRow, setSelectedRow] = useState(null);
  const [viewMode, setViewMode] = useState(window.innerWidth < 768 ? 'cards' : 'table');

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setViewMode('cards');
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadedRef = useRef(false);

  const load = useCallback(async () => {
    if (!loadedRef.current) setLoading(true);
    try {
      // Ensure DB columns exist (barcode, receiver, stock_type)
      ensureSchema().catch(() => {});

      const [i, c, u] = await Promise.all([
        apiGet('/api/stock/items'),
        apiGet('/api/stock/categories'),
        apiGet('/api/cached/users'),
      ]);
      if (i.success) {
        setItems(i.data);
        try { localStorage.setItem('cached_stock_items', JSON.stringify(i.data)); } catch {}
      }
      if (c.success) {
        setCategories(c.data);
        try { localStorage.setItem('cached_stock_categories', JSON.stringify(c.data)); } catch {}
      }
      if (u.success) setUsers((u.data || []).map(row => ({ ...row, full_name: row.full_name || row.name })));
    } catch (err) {
      console.error('Stok verileri yüklenemedi:', err);
    } finally {
      loadedRef.current = true;
      setLoading(false);
    }
  }, []);

  const stockVersion = [
    tableRefreshVersions.stock_items || 0,
    tableRefreshVersions.stock_movements || 0,
    tableRefreshVersions.stock_categories || 0,
  ].join('|');

  useEffect(() => { load(); }, [load, refreshToggle, stockVersion]);

  const openNew = async () => {
    const codeRes = await apiPost('/api/util/generate-code', { type: 'stock' });
    setEditItem(null);
    setForm({
      ...EMPTY_FORM,
      stock_code: codeRes.value || '',
      barcode: codeRes.value || '',
      stock_type: stockTypeFilter === 'scrap' ? 'scrap' : 'office',
    });
    setShowForm(true);
  };

  const openEdit = (row) => {
    setEditItem(row);
    setForm({
      id: row.id,
      stock_code: row.stock_code || '',
      barcode: row.barcode || row.stock_code || '',
      name: row.name || '',
      category_id: row.category_id || '',
      category_name: row.category_name || '',
      stock_type: row.stock_type || 'office',
      qty: row.qty ?? 0,
      unit: row.unit || 'Adet',
      critical_qty: row.critical_qty ?? 0,
      unit_price: row.unit_price ?? '',
      location: row.location || '',
      description: row.description || '',
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name?.trim()) {
      showNotification('Ürün adı zorunludur.', 'warning');
      return;
    }
    if (Number(form.qty) < 0 || Number(form.critical_qty) < 0 || Number(form.unit_price) < 0) {
      showNotification('Miktar, kritik seviye ve fiyat negatif olamaz.', 'warning');
      return;
    }
    const currentStockType = form.stock_type === 'scrap' ? 'scrap' : 'office';
    const typeLabel = currentStockType === 'scrap' ? 'Hurda Stoğu' : 'Ofis Stoğu';
    setSaving(true);
    try {
      if (editItem?.id) {
        const res = await apiPut(`/api/stock/items/${editItem.id}`, {
          name: form.name.trim(),
          barcode: form.barcode?.trim() || form.stock_code || null,
          category_id: form.category_id || null,
          unit: form.unit || 'Adet',
          critical_qty: Number(form.critical_qty) || 0,
          unit_price: Number(form.unit_price) || 0,
          location: form.location?.trim() || null,
          description: form.description?.trim() || null,
          stock_type: currentStockType,
        });
        if (!res.success) throw new Error(res.message);
        await auditLog({
          action: 'UPDATE',
          module: 'stock',
          refId: editItem.id,
          description: `"${form.name}" ürün bilgileri güncellendi (${typeLabel}).`,
        });
        showNotification('Ürün güncellendi.', 'success');
      } else {
        const res = await apiPost('/api/stock/items', {
          stock_code: form.stock_code?.trim() || String(Date.now()),
          name: form.name.trim(),
          barcode: form.barcode?.trim() || form.stock_code?.trim() || null,
          category_id: form.category_id || null,
          unit: form.unit || 'Adet',
          qty: Number(form.qty) || 0,
          critical_qty: Number(form.critical_qty) || 0,
          unit_price: Number(form.unit_price) || 0,
          location: form.location?.trim() || null,
          description: form.description?.trim() || null,
          user_id: user?.id || null,
          stock_type: currentStockType,
        });
        if (!res.success) throw new Error(res.message);
        const newId = res.insertId;
        await auditLog({
          action: 'CREATE',
          module: 'stock',
          refId: newId,
          description: `"${form.name}" ürünü oluşturuldu (${form.qty} ${form.unit} - ${typeLabel}).`,
        });
        showNotification('Ürün oluşturuldu.', 'success');
      }
      setShowForm(false);
      triggerRefresh();
      load();
    } catch (err) {
      console.error(err);
      showNotification('Kaydetme hatası: ' + err.message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const doAdjust = async () => {
    if (!adjustTarget?.id) return;
    const qty = Number(adjustQty);
    if (!qty || qty <= 0) {
      showNotification('Geçerli bir miktar girin.', 'warning');
      return;
    }
    const typeLabel = adjustType === 'add' ? 'Giriş' : adjustType === 'sub' ? 'Çıkış' : 'Düzeltme';
    try {
      if (adjustType === 'sub') {
        const current = Number(adjustTarget.qty || 0);
        if (qty > current) {
          showNotification(`Yetersiz stok! Mevcut: ${current} ${adjustTarget.unit}`, 'danger');
          return;
        }
      }
      const res = await apiPost('/api/stock/adjust', {
        id: adjustTarget.id,
        type: adjustType,
        qty,
        note: adjustNote?.trim() || null,
        user_id: user?.id || null,
      });
      if (!res.success) {
        showNotification(res.message || 'Stok hareketi kaydedilemedi.', 'danger');
        return;
      }
      await auditLog({
        action: 'UPDATE',
        module: 'stock',
        refId: adjustTarget.id,
        description: `${adjustTarget.name} stok hareketi: ${typeLabel} ${qty} ${adjustTarget.unit}.`,
      });
      showNotification(`Stok ${typeLabel} kaydedildi.`, 'success');
      setAdjustTarget(null);
      triggerRefresh();
      load();
    } catch (err) {
      console.error(err);
      showNotification('Hareket hatası: ' + err.message, 'danger');
    }
  };

  const findItemByScan = (value) => {
    const v = String(value || '').trim().toLowerCase();
    if (!v) return null;
    return (
      items.find(i => String(i.barcode || '').trim().toLowerCase() === v) ||
      items.find(i => String(i.stock_code || '').trim().toLowerCase() === v)
    );
  };

  const doScan = () => {
    const value = String(scanValue || '').trim();
    if (!value) {
      showNotification('Barkodu okutun veya kod girin.', 'warning');
      return;
    }
    const item = findItemByScan(value);
    if (!item) {
      showNotification(`"${value}" için ürün bulunamadı.`, 'danger');
      setScanValue('');
      return;
    }
    setCheckout(item);
    setChkQty('1');
    setChkUser('');
    setChkNote('');
    setScanValue('');
  };

  const doCheckout = async () => {
    if (!checkout?.id) return;
    const qty = Number(chkQty);
    if (!qty || qty <= 0) {
      showNotification('Geçerli bir miktar girin.', 'warning');
      return;
    }
    if (qty > Number(checkout.qty || 0)) {
      showNotification(`Yetersiz stok! Mevcut: ${checkout.qty} ${checkout.unit}`, 'danger');
      return;
    }
    try {
      const res = await apiPost('/api/stock/checkout', {
        id: checkout.id,
        qty,
        receiver: chkUser?.trim() || null,
        user_id: user?.id || null,
        note: chkNote?.trim() || null,
      });
      if (!res.success) {
        showNotification(res.message || 'Teslim işlemi yapılamadı.', 'danger');
        return;
      }
      await auditLog({
        action: 'UPDATE',
        module: 'stock',
        refId: checkout.id,
        description: `"${checkout.name}" teslim edildi (${qty} ${checkout.unit}) ${chkUser ? '→ ' + chkUser : ''}.`,
      });
      showNotification(`"${checkout.name}" ${qty} ${checkout.unit} teslim edildi.`, 'success');
      setCheckout(null);
      triggerRefresh();
      load();
    } catch (err) {
      console.error(err);
      showNotification('Teslim hatası: ' + err.message, 'danger');
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await apiPost('/api/stock/items/delete', { id: deleteTarget.id });
      if (!res.success) throw new Error(res.message);
      await auditLog({
        action: 'DELETE',
        module: 'stock',
        refId: deleteTarget.id,
        description: `"${deleteTarget.name}" stoktan silindi.`,
      });
      showNotification('Ürün stoktan silindi.', 'success');
      triggerRefresh();
      load();
    } catch (err) {
      console.error(err);
      showNotification('Silme hatası: ' + err.message, 'danger');
    } finally {
      setDeleteTarget(null);
    }
  };

  const deleteSelected = async () => {
    if (!selectedRows.length) return;
    const ids = selectedRows.map(r => r.id);
    try {
      const res = await apiPost('/api/stock/items/delete-many', { ids });
      if (!res.success) throw new Error(res.message);
      await auditLog({
        action: 'DELETE',
        module: 'stock',
        refId: null,
        description: `${ids.length} stok kalemi silindi: ${selectedRows.map(r => r.sku || r.name).join(', ')}.`,
      });
      showNotification(`${ids.length} stok kalemi silindi.`, 'success');
      setSelectedRows([]);
      triggerRefresh();
      load();
    } catch (err) {
      console.error(err);
      showNotification('Silme hatası: ' + err.message, 'danger');
    }
  };

  const loadMovements = async (item) => {
    setMovementsFor(item);
    setMovLoading(true);
    setMovements([]);
    try {
      const res = await apiGet('/api/stock/movements', { stock_id: item.id });
      if (res.success) setMovements(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setMovLoading(false);
    }
  };

  const printLabel = async () => {
    if (!labelTarget) return;
    const code = labelTarget.barcode || labelTarget.stock_code || String(labelTarget.id);
    try {
      const qrData = await QRCode.toDataURL(code, { width: 160, margin: 1 });
      const svgContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      await new Promise((resolve, reject) => {
        JsBarcode(svgContainer, code, {
          format: 'CODE128',
          width: 2, height: 60, displayValue: true, margin: 6,
        });
        resolve();
      });
      const barcodeSvg = svgContainer.outerHTML;
      const labelHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Etiket: ${code}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 0; }
  .label { width: 340px; padding: 16px; text-align: center; border-bottom: 1px dashed #ccc; page-break-after: always; }
  .label .name { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
  .label .cat { font-size: 10px; color: #666; margin-bottom: 8px; }
  .label .code { font-size: 12px; margin-bottom: 6px; color: #333; }
</style></head><body>
  ${labelMode === 'barcode' ? `<div class="label"><div class="name">${labelTarget.name}</div><div class="cat">${labelTarget.category_name || ''}${labelTarget.location ? ' • ' + labelTarget.location : ''}</div><div class="code">${code}</div>${barcodeSvg}</div>` : `<div class="label"><div class="name">${labelTarget.name}</div><div class="cat">${labelTarget.category_name || ''}${labelTarget.location ? ' • ' + labelTarget.location : ''}</div><div class="code">${code}</div><img src="${qrData}" style="width:150px;height:150px;" /></div>`}
</body></html>`;
      await window.electronAPI.printHtml(labelHtml);
      showNotification('Etiket yazdırma başlatıldı.', 'success');
    } catch (err) {
      console.error(err);
      showNotification('Etiket üretilemedi: ' + err.message, 'danger');
    }
  };

  const officeItems = useMemo(() =>
    items.filter(i => (i.stock_type || 'office') === 'office'), [items]);

  const scrapItems = useMemo(() =>
    items.filter(i => i.stock_type === 'scrap'), [items]);

  const criticalLow = useMemo(() =>
    items.filter(i => Number(i.qty || 0) <= Number(i.critical_qty || 0)), [items]);

  const visibleItems = useMemo(() => {
    let list = items;
    if (stockTypeFilter === 'office') {
      list = list.filter(i => (i.stock_type || 'office') === 'office');
    } else if (stockTypeFilter === 'scrap') {
      list = list.filter(i => i.stock_type === 'scrap');
    }
    if (filterCriticalOnly) {
      list = list.filter(i => Number(i.qty || 0) <= Number(i.critical_qty || 0));
    }
    const term = searchText.trim().toLocaleLowerCase('tr-TR');
    if (term) {
      list = list.filter(i => [
        i.name,
        i.stock_code,
        i.barcode,
        i.category_name,
        i.location,
        i.stock_type === 'scrap' ? 'hurda hurda deposu' : 'ofis ofis stogu'
      ].some(f => String(f || '').toLocaleLowerCase('tr-TR').includes(term)));
    }
    return list;
  }, [items, stockTypeFilter, filterCriticalOnly, searchText]);

  const totalQty = items.reduce((s, i) => s + Number(i.qty || 0), 0);
  const officeQty = officeItems.reduce((s, i) => s + Number(i.qty || 0), 0);
  const scrapQty = scrapItems.reduce((s, i) => s + Number(i.qty || 0), 0);
  const stockValue = items.reduce((s, i) => s + (Number(i.qty || 0) * Number(i.unit_price || 0)), 0);

  const handleExportExcel = () => {
    if (visibleItems.length === 0) {
      showNotification('Dışa aktarılacak stok kaydı bulunamadı.', 'warning');
      return;
    }

    const escapeXml = (val) => String(val ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    const dateStr = new Date().toLocaleDateString('tr-TR');
    const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const filterTitle = stockTypeFilter === 'office'
      ? 'Ofis Stoğu (Aktif Malzemeler)'
      : stockTypeFilter === 'scrap'
        ? 'Hurda Stoğu (Depo Hurdaları)'
        : 'Tüm Stoklar (Ofis ve Depo Hurda)';

    const totalQtyFiltered = visibleItems.reduce((s, i) => s + Number(i.qty || 0), 0);
    const totalValFiltered = visibleItems.reduce((s, i) => s + (Number(i.qty || 0) * Number(i.unit_price || 0)), 0);

    let xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="DocTitle">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="14" ss:Bold="1" ss:Color="#0f172a"/>
  </Style>
  <Style ss:ID="DocSubtitle">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#64748b"/>
  </Style>
  <Style ss:ID="TblHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#475569"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#475569"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#475569"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#475569"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#0f172a" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="TblCell">
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#1e293b"/>
  </Style>
  <Style ss:ID="TblCellCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#1e293b"/>
  </Style>
  <Style ss:ID="TblCellNumber">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#1e293b"/>
   <NumberFormat ss:Format="#,##0"/>
  </Style>
  <Style ss:ID="TblCellCurrency">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#1e293b"/>
   <NumberFormat ss:Format="₺#,##0.00"/>
  </Style>
  <Style ss:ID="TblCellTypeOffice">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#0369a1"/>
   <Interior ss:Color="#e0f2fe" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="TblCellTypeScrap">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#b91c1c"/>
   <Interior ss:Color="#fee2e2" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="TblFooter">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#0f172a"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0f172a"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#0f172a"/>
   <Interior ss:Color="#f1f5f9" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Stok Listesi">
  <Table>
   <Column ss:Width="40"/>
   <Column ss:Width="110"/>
   <Column ss:Width="120"/>
   <Column ss:Width="200"/>
   <Column ss:Width="110"/>
   <Column ss:Width="120"/>
   <Column ss:Width="70"/>
   <Column ss:Width="60"/>
   <Column ss:Width="70"/>
   <Column ss:Width="90"/>
   <Column ss:Width="100"/>
   <Column ss:Width="110"/>
   <Column ss:Width="200"/>

   <Row ss:Height="26">
    <Cell ss:MergeAcross="12" ss:StyleID="DocTitle"><Data ss:Type="String">BİLGİ TEKNOLOJİLERİ — STOK VE ENVANTER TAKİP LİSTESİ</Data></Cell>
   </Row>
   <Row ss:Height="18">
    <Cell ss:MergeAcross="12" ss:StyleID="DocSubtitle"><Data ss:Type="String">Kapsam: ${filterTitle} • Rapor Tarihi: ${dateStr} ${timeStr}</Data></Cell>
   </Row>
   <Row></Row>

   <Row ss:Height="24">
    <Cell ss:StyleID="TblHeader"><Data ss:Type="String">#</Data></Cell>
    <Cell ss:StyleID="TblHeader"><Data ss:Type="String">Stok Kodu</Data></Cell>
    <Cell ss:StyleID="TblHeader"><Data ss:Type="String">Barkod</Data></Cell>
    <Cell ss:StyleID="TblHeader"><Data ss:Type="String">Ürün Adı</Data></Cell>
    <Cell ss:StyleID="TblHeader"><Data ss:Type="String">Stok Türü</Data></Cell>
    <Cell ss:StyleID="TblHeader"><Data ss:Type="String">Kategori</Data></Cell>
    <Cell ss:StyleID="TblHeader"><Data ss:Type="String">Miktar</Data></Cell>
    <Cell ss:StyleID="TblHeader"><Data ss:Type="String">Birim</Data></Cell>
    <Cell ss:StyleID="TblHeader"><Data ss:Type="String">Kritik Limit</Data></Cell>
    <Cell ss:StyleID="TblHeader"><Data ss:Type="String">Birim Fiyat</Data></Cell>
    <Cell ss:StyleID="TblHeader"><Data ss:Type="String">Toplam Tutar</Data></Cell>
    <Cell ss:StyleID="TblHeader"><Data ss:Type="String">Raf / Depo</Data></Cell>
    <Cell ss:StyleID="TblHeader"><Data ss:Type="String">Açıklama</Data></Cell>
   </Row>`;

    visibleItems.forEach((item, idx) => {
      const isScrap = item.stock_type === 'scrap';
      const qtyNum = Number(item.qty || 0);
      const priceNum = Number(item.unit_price || 0);
      const totalItemVal = qtyNum * priceNum;

      xml += `
   <Row ss:Height="20">
    <Cell ss:StyleID="TblCellCenter"><Data ss:Type="Number">${idx + 1}</Data></Cell>
    <Cell ss:StyleID="TblCellCenter"><Data ss:Type="String">${escapeXml(item.stock_code)}</Data></Cell>
    <Cell ss:StyleID="TblCellCenter"><Data ss:Type="String">${escapeXml(item.barcode || item.stock_code)}</Data></Cell>
    <Cell ss:StyleID="TblCell"><Data ss:Type="String">${escapeXml(item.name)}</Data></Cell>
    <Cell ss:StyleID="${isScrap ? 'TblCellTypeScrap' : 'TblCellTypeOffice'}"><Data ss:Type="String">${isScrap ? 'Hurda (Depo)' : 'Ofis Malzemesi'}</Data></Cell>
    <Cell ss:StyleID="TblCell"><Data ss:Type="String">${escapeXml(item.category_name || '—')}</Data></Cell>
    <Cell ss:StyleID="TblCellNumber"><Data ss:Type="Number">${qtyNum}</Data></Cell>
    <Cell ss:StyleID="TblCellCenter"><Data ss:Type="String">${escapeXml(item.unit || 'Adet')}</Data></Cell>
    <Cell ss:StyleID="TblCellNumber"><Data ss:Type="Number">${Number(item.critical_qty || 0)}</Data></Cell>
    <Cell ss:StyleID="TblCellCurrency"><Data ss:Type="Number">${priceNum}</Data></Cell>
    <Cell ss:StyleID="TblCellCurrency"><Data ss:Type="Number">${totalItemVal}</Data></Cell>
    <Cell ss:StyleID="TblCell"><Data ss:Type="String">${escapeXml(item.location || '—')}</Data></Cell>
    <Cell ss:StyleID="TblCell"><Data ss:Type="String">${escapeXml(item.description || '')}</Data></Cell>
   </Row>`;
    });

    xml += `
   <Row ss:Height="22">
    <Cell ss:MergeAcross="5" ss:StyleID="TblFooter"><Data ss:Type="String">GENEL TOPLAM:</Data></Cell>
    <Cell ss:StyleID="TblFooter"><Data ss:Type="Number">${totalQtyFiltered}</Data></Cell>
    <Cell ss:StyleID="TblFooter"><Data ss:Type="String">Kalem</Data></Cell>
    <Cell ss:StyleID="TblFooter"><Data ss:Type="String"></Data></Cell>
    <Cell ss:StyleID="TblFooter"><Data ss:Type="String"></Data></Cell>
    <Cell ss:StyleID="TblFooter"><Data ss:Type="Number">${totalValFiltered}</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="TblFooter"><Data ss:Type="String"></Data></Cell>
   </Row>
  </Table>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const dateFormatted = new Date().toISOString().slice(0, 10);
    const safeType = stockTypeFilter === 'office' ? 'Ofis_Stogu' : stockTypeFilter === 'scrap' ? 'Hurda_Stogu' : 'Tum_Stoklar';
    link.setAttribute('download', `Stok_Listesi_${safeType}_${dateFormatted}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotification('Excel dosyası başarıyla indirildi.', 'success');
  };

  const columnDefs = useMemo(() => [
    { field: 'select', headerName: '', width: 46, pinned: 'left', sortable: false, resizable: false, suppressMenu: true,
      headerCheckboxSelection: true, headerCheckboxSelectionFilteredOnly: true,
      checkboxSelection: true },
    { field: 'barcode', headerName: 'Barkod / Kod', width: 130, pinned: 'left',
      cellRenderer: params => (
        <button className="btn btn-link btn-xs" onClick={() => { setLabelTarget(params.data); setLabelMode('barcode'); }}>
          🏷️ {params.value || params.data.stock_code}
        </button>
      ) },
    { field: 'name', headerName: 'Ürün Adı', flex: 1, minWidth: 200, filter: 'agTextColumnFilter' },
    {
      field: 'stock_type',
      headerName: 'Stok Türü',
      width: 135,
      cellRenderer: params => {
        const isScrap = params.value === 'scrap';
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 12,
            fontSize: 11,
            fontWeight: 700,
            background: isScrap ? 'rgba(239, 68, 68, 0.12)' : 'rgba(14, 165, 233, 0.12)',
            color: isScrap ? '#ef4444' : '#0284c7',
            border: `1px solid ${isScrap ? 'rgba(239, 68, 68, 0.25)' : 'rgba(14, 165, 233, 0.25)'}`
          }}>
            {isScrap ? '♻️ Hurda Stoğu' : '🏢 Ofis Stoğu'}
          </span>
        );
      }
    },
    { field: 'category_name', headerName: 'Kategori', width: 120, filter: 'agTextColumnFilter' },
    {
      field: 'qty', headerName: 'Stokta', width: 100,
      cellClassRules: {
        'cell-qty-low': params => Number(params.value || 0) <= Number(params.data.critical_qty || 0),
        'cell-qty-ok': params => Number(params.value || 0) > Number(params.data.critical_qty || 0),
      },
      valueFormatter: params => `${params.value} ${params.data.unit || ''}`,
    },
    { field: 'critical_qty', headerName: 'Kritik', width: 80, cellClass: 'cell-muted' },
    { field: 'unit_price', headerName: 'Birim ₺', width: 100,
      valueFormatter: params => params.value ? `₺${Number(params.value).toFixed(2)}` : '—' },
    { field: 'location', headerName: 'Raf / Depo', width: 120, filter: 'agTextColumnFilter', cellClass: 'cell-muted' },
    {
      headerName: 'İşlemler', width: 210, pinned: 'right',
      cellRenderer: params => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          <button className="btn btn-info btn-xs" title="Barkod & QR Gör" onClick={() => { setLabelTarget(params.data); setLabelMode('barcode'); }}>🏷️</button>
          <button className="btn btn-success btn-xs" title="Stok Hareketi" onClick={() => { setAdjustTarget(params.data); setAdjustType('add'); setAdjustQty('1'); setAdjustNote(''); }}>📦</button>
          {hasPermission('stock', 'can_edit') && (
            <button className="btn btn-secondary btn-xs" title="Düzenle" onClick={() => { setEditItem(params.data); setForm({ ...params.data, barcode: params.data.barcode || params.data.stock_code, stock_type: params.data.stock_type || 'office' }); setShowForm(true); }}>✏️</button>
          )}
          {hasPermission('stock', 'can_delete') && (
            <button className="btn btn-danger btn-xs" title="Kaldır" onClick={() => setDeleteTarget(params.data)}>🗑️</button>
          )}
        </div>
      )
    }
  ], [hasPermission]);

  return (
    <div className="module-container" style={{ padding: '8px 12px' }}>
      {/* 4'lü Modern KPI Özet Kartları */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 10,
        marginBottom: 10
      }}>
        {/* Ofis Stoğu */}
        <div
          onClick={() => setStockTypeFilter(curr => curr === 'office' ? 'all' : 'office')}
          style={{
            background: stockTypeFilter === 'office' ? 'rgba(14, 165, 233, 0.12)' : 'var(--color-surface)',
            border: `1px solid ${stockTypeFilter === 'office' ? '#0284c7' : 'var(--color-border)'}`,
            borderRadius: 10,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          title="Ofis stoklarını filtrelemek için tıklayın"
        >
          <div style={{
            width: 38, height: 38, borderRadius: 8,
            background: 'rgba(14, 165, 233, 0.15)', color: '#0284c7',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
          }}>
            🏢
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>OFİS STOĞU</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#0284c7' }}>
              {officeQty.toFixed(0)} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>Adet ({officeItems.length} Kalem)</span>
            </div>
          </div>
        </div>

        {/* Hurda Stoğu */}
        <div
          onClick={() => setStockTypeFilter(curr => curr === 'scrap' ? 'all' : 'scrap')}
          style={{
            background: stockTypeFilter === 'scrap' ? 'rgba(239, 68, 68, 0.12)' : 'var(--color-surface)',
            border: `1px solid ${stockTypeFilter === 'scrap' ? '#ef4444' : 'var(--color-border)'}`,
            borderRadius: 10,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          title="Depodaki hurda stoklarını filtrelemek için tıklayın"
        >
          <div style={{
            width: 38, height: 38, borderRadius: 8,
            background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
          }}>
            ♻️
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>HURDA STOĞU (DEPO)</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#ef4444' }}>
              {scrapQty.toFixed(0)} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>Adet ({scrapItems.length} Kalem)</span>
            </div>
          </div>
        </div>

        {/* Kritik Kalemler */}
        <div
          onClick={() => setFilterCriticalOnly(v => !v)}
          style={{
            background: filterCriticalOnly ? 'rgba(245, 158, 11, 0.12)' : 'var(--color-surface)',
            border: `1px solid ${filterCriticalOnly ? '#f59e0b' : 'var(--color-border)'}`,
            borderRadius: 10,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            cursor: 'pointer',
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            transition: 'all 0.2s ease'
          }}
          title="Kritik seviyedeki ürünleri filtrelemek için tıklayın"
        >
          <div style={{
            width: 38, height: 38, borderRadius: 8,
            background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
          }}>
            ⚠️
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>KRİTİK SEVİYE</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#f59e0b' }}>
              {criticalLow.length} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>Ürün {filterCriticalOnly ? '(Filtreli)' : ''}</span>
            </div>
          </div>
        </div>

        {/* Stok Değeri */}
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 10,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 8,
            background: 'rgba(16, 185, 129, 0.12)', color: '#10b981',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
          }}>
            💰
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>TOPLAM STOK DEĞERİ</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#10b981' }}>
              ₺{stockValue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* Ana İşlem & Hızlı Arama Ribbon Çubuğu */}
      <div className="legacy-ribbon" style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        alignItems: 'center',
        padding: '8px 14px',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        marginBottom: 10
      }}>
        {/* Sol Taraf: İşlem Butonları */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {hasPermission('stock', 'can_create') && (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={openNew}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px', fontWeight: 700, fontSize: 12, borderRadius: 8 }}
            >
              <span>➕</span>
              <span>Yeni Ürün</span>
            </button>
          )}

          {hasPermission('stock', 'can_edit') && (
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => selectedRow && openEdit(selectedRow)}
              disabled={!selectedRow}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: 12, borderRadius: 8, opacity: selectedRow ? 1 : 0.5 }}
            >
              <span>✏️</span>
              <span>Düzenle</span>
            </button>
          )}

          {hasPermission('stock', 'can_edit') && (
            <button
              type="button"
              className="btn btn-sm btn-success"
              onClick={() => selectedRow && (setAdjustTarget(selectedRow), setAdjustType('sub'), setAdjustQty('1'), setAdjustNote(''))}
              disabled={!selectedRow}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: 12, borderRadius: 8, opacity: selectedRow ? 1 : 0.5 }}
              title="Seçili üründen stok çıkışı yap"
            >
              <span>⚡</span>
              <span>Stok Çıkışı</span>
            </button>
          )}

          {hasPermission('stock', 'can_delete') && (
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={() => {
                if (selectedRows.length > 0) setConfirmDeleteSelected(true);
                else if (selectedRow) setDeleteTarget(selectedRow);
              }}
              disabled={!selectedRow && selectedRows.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: 12, borderRadius: 8, opacity: (selectedRow || selectedRows.length > 0) ? 1 : 0.5 }}
            >
              <span>🗑️</span>
              <span>{selectedRows.length > 1 ? `Sil (${selectedRows.length})` : 'Sil'}</span>
            </button>
          )}

          {/* Excel Dışa Aktar Butonu */}
          <button
            type="button"
            className="btn btn-sm"
            onClick={handleExportExcel}
            title="Stok listesini Excel (.xls) formatında indir"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: '1px solid #047857',
              color: '#ffffff',
              boxShadow: '0 2px 4px rgba(16, 185, 129, 0.25)'
            }}
          >
            <span>📥</span>
            <span>Excel'e Aktar</span>
          </button>
        </div>

        {/* Dikey Ayrıcı Çizgi */}
        <div style={{ width: 1, height: 22, background: 'var(--color-border)', margin: '0 2px' }} />

        {/* Araçlar: Yenile */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={load}
            disabled={loading}
            title="Tüm stok listesini ve canlı adetleri yenile"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              background: 'rgba(59, 130, 246, 0.12)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              color: '#38bdf8'
            }}
          >
            <span style={{ fontSize: 14, display: 'inline-block', transform: loading ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease' }}>
              🔄
            </span>
            <span>{loading ? 'Yenileniyor...' : 'Yenile'}</span>
          </button>
        </div>

        {/* Orta: Stok Türü Filtre Butonları */}
        <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', margin: '0 4px' }}>
          <button
            type="button"
            onClick={() => setStockTypeFilter('all')}
            className={`btn btn-xs ${stockTypeFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: 0, padding: '5px 10px', fontSize: 11.5, fontWeight: 700 }}
          >
            📋 Tümü ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setStockTypeFilter('office')}
            className={`btn btn-xs ${stockTypeFilter === 'office' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: 0, padding: '5px 10px', fontSize: 11.5, fontWeight: 700 }}
          >
            🏢 Ofis ({officeItems.length})
          </button>
          <button
            type="button"
            onClick={() => setStockTypeFilter('scrap')}
            className={`btn btn-xs ${stockTypeFilter === 'scrap' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: 0, padding: '5px 10px', fontSize: 11.5, fontWeight: 700 }}
          >
            ♻️ Hurda ({scrapItems.length})
          </button>
        </div>

        {/* Sağ Taraf: Canlı Arama, Kritik Filtresi & Görünüm Değiştirici */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', margin: 0, fontWeight: 600, color: filterCriticalOnly ? '#ef4444' : 'var(--color-text-secondary)' }}>
            <input type="checkbox" checked={filterCriticalOnly} onChange={e => setFilterCriticalOnly(e.target.checked)} />
            ⚠️ Sadece Kritik
          </label>

          <div style={{ position: 'relative', width: 280 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--color-text-muted)', pointerEvents: 'none' }}>🔍</span>
            <input
              type="text"
              className="form-control"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="Ürün adı, barkod, kategori, raf..."
              style={{
                paddingLeft: 30,
                paddingRight: searchText ? 26 : 10,
                height: 32,
                borderRadius: 8,
                fontSize: 12,
                background: 'var(--color-surface-alt)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)'
              }}
            />
            {searchText && (
              <button
                type="button"
                onClick={() => setSearchText('')}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 11
                }}
                title="Aramayı Temizle"
              >
                ✕
              </button>
            )}
          </div>

          <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`btn btn-xs ${viewMode === 'cards' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: 0, padding: '4px 8px', fontSize: 11, fontWeight: 700 }}
              title="Kart Görünümü"
            >
              📱 Kart
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`btn btn-xs ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: 0, padding: '4px 8px', fontSize: 11, fontWeight: 700 }}
              title="Tablo Görünümü"
            >
              📊 Tablo
            </button>
          </div>
        </div>
      </div>

      {/* Kompakt Hızlı Barkod / QR Tarayıcı Barı */}
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        padding: '8px 14px',
        marginBottom: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18, color: '#eab308' }}>⚡</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--color-text)' }}>Hızlı Barkod / QR Okuyucu</div>
            <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)' }}>Okutulan ürünün stok çıkış ve teslim penceresini anında açar</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flex: '1 1 300px', maxWidth: 460 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.6, fontSize: 13, pointerEvents: 'none' }}>
              🏷️
            </span>
            <input
              ref={scanRef}
              className="form-control"
              value={scanValue}
              onChange={e => setScanValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') doScan(); }}
              placeholder="Barkod veya Stok Kodu okutun / yazın..."
              style={{
                paddingLeft: 30,
                height: 32,
                fontSize: 12,
                fontWeight: 600,
                background: 'var(--color-surface-alt)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                borderRadius: 6
              }}
            />
            {scanValue && (
              <button
                type="button"
                onClick={() => setScanValue('')}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 11
                }}
              >
                ✕
              </button>
            )}
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={doScan}
            style={{ display: 'flex', alignItems: 'center', gap: 5, height: 32, padding: '0 12px', fontWeight: 700, fontSize: 11.5, borderRadius: 6 }}
          >
            <span>🔍</span>
            <span>Bul & Teslim Et</span>
          </button>
        </div>
      </div>

      {/* Seçili Ürün Detay Önizleme Kartı (Tablo Modunda) */}
      {viewMode !== 'cards' && selectedRow && (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 10,
          padding: '8px 14px',
          marginBottom: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          fontSize: 12,
          boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 15 }}>📦</span>
              <strong style={{ fontSize: 13, color: 'var(--color-primary)' }}>{selectedRow.name}</strong>
            </div>
            <span style={{
              padding: '2px 8px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              background: selectedRow.stock_type === 'scrap' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(14, 165, 233, 0.12)',
              color: selectedRow.stock_type === 'scrap' ? '#ef4444' : '#0284c7',
              border: `1px solid ${selectedRow.stock_type === 'scrap' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(14, 165, 233, 0.25)'}`
            }}>
              {selectedRow.stock_type === 'scrap' ? '♻️ Hurda Stoğu' : '🏢 Ofis Stoğu'}
            </span>
            <span style={{ fontFamily: 'monospace', color: 'var(--color-text-muted)', background: 'var(--color-surface-alt)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--color-border)' }}>
              🏷️ {selectedRow.barcode || selectedRow.stock_code}
            </span>
            {selectedRow.category_name && (
              <span style={{ color: 'var(--color-text-secondary)' }}>📁 {selectedRow.category_name}</span>
            )}
            {selectedRow.location && (
              <span style={{ color: 'var(--color-text-muted)' }}>📍 Raf: {selectedRow.location}</span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className={`badge ${Number(selectedRow.qty || 0) <= Number(selectedRow.critical_qty || 0) ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: 11.5, fontWeight: 700 }}>
              Stok: {selectedRow.qty} {selectedRow.unit}
            </span>
            {selectedRow.critical_qty > 0 && (
              <span className="badge badge-secondary" style={{ fontSize: 11 }}>
                Kritik: {selectedRow.critical_qty} {selectedRow.unit}
              </span>
            )}
            {selectedRow.unit_price > 0 && (
              <span style={{ fontWeight: 700, color: '#10b981' }}>
                ₺{Number(selectedRow.unit_price).toFixed(2)}
              </span>
            )}
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              onClick={() => { setLabelTarget(selectedRow); setLabelMode('barcode'); }}
              style={{ borderRadius: 6, padding: '3px 8px', fontSize: 11 }}
              title="Barkod / QR Etiketi Yazdır"
            >
              🏷️ Barkod Bas
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              onClick={() => loadMovements(selectedRow)}
              style={{ borderRadius: 6, padding: '3px 8px', fontSize: 11 }}
              title="Ürün Stok Hareket Geçmişini Gör"
            >
              📜 Hareketler
            </button>
          </div>
        </div>
      )}

      {/* Veri Kartları veya AgGrid Tablosu */}
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        padding: 10,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
      }}>
        {viewMode === 'cards' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, maxHeight: 'calc(100vh - 430px)', overflowY: 'auto', paddingRight: 4 }}>
            {visibleItems.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: 'var(--color-text-muted)', fontSize: 13 }}>
                Aranan kriterlere uygun stok kalemi bulunamadı.
              </div>
            ) : (
              visibleItems.map(item => {
                const isCritical = Number(item.qty || 0) <= Number(item.critical_qty || 0);
                const isScrap = item.stock_type === 'scrap';
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedRow(item)}
                    style={{
                      background: selectedRow?.id === item.id ? 'var(--color-surface)' : 'var(--color-surface-alt)',
                      border: `1px solid ${selectedRow?.id === item.id ? 'var(--color-primary)' : isCritical ? 'rgba(239, 68, 68, 0.5)' : 'var(--color-border)'}`,
                      borderRadius: 8,
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                          <span style={{
                            padding: '1px 6px',
                            borderRadius: 6,
                            fontSize: 10,
                            fontWeight: 700,
                            background: isScrap ? 'rgba(239, 68, 68, 0.12)' : 'rgba(14, 165, 233, 0.12)',
                            color: isScrap ? '#ef4444' : '#0284c7'
                          }}>
                            {isScrap ? '♻️ Hurda' : '🏢 Ofis'}
                          </span>
                          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-text)' }}>{item.name}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--color-primary)', fontWeight: 600 }}>{item.stock_code}</span>
                          {item.barcode && item.barcode !== item.stock_code && (
                            <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>({item.barcode})</span>
                          )}
                        </div>
                      </div>
                      <span className={`badge ${isCritical ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: 11, fontWeight: 700 }}>
                        {item.qty} {item.unit}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11, color: 'var(--color-text-secondary)', background: 'var(--color-surface)', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border)' }}>
                      <div>🏷️ <b>Kategori:</b> {item.category_name || '—'}</div>
                      <div>📍 <b>Raf:</b> {item.location || '—'}</div>
                      <div>⚠️ <b>Kritik Sınır:</b> {item.critical_qty} {item.unit}</div>
                      <div>💰 <b>Fiyat:</b> {item.unit_price ? `₺${Number(item.unit_price).toFixed(2)}` : '—'}</div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, marginTop: 2, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => { setAdjustTarget(item); setAdjustType('sub'); setAdjustQty('1'); setAdjustNote(''); }}
                        style={{ flex: 1, minWidth: 85, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '5px 6px', borderRadius: 6 }}
                      >
                        ⚡ Çıkış
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => { setAdjustTarget(item); setAdjustType('add'); setAdjustQty('1'); setAdjustNote(''); }}
                        style={{ flex: 1, minWidth: 85, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '5px 6px', borderRadius: 6 }}
                      >
                        ➕ Giriş
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => { setLabelTarget(item); setLabelMode('barcode'); }}
                        title="Barkod / QR Bas"
                        style={{ padding: '5px 8px', fontSize: 12, borderRadius: 6 }}
                      >
                        🏷️
                      </button>
                      {hasPermission('stock', 'can_edit') && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => { setEditItem(item); setForm({ ...item, barcode: item.barcode || item.stock_code, stock_type: item.stock_type || 'office' }); setShowForm(true); }}
                          title="Düzenle"
                          style={{ padding: '5px 8px', fontSize: 12, borderRadius: 6 }}
                        >
                          ✏️
                        </button>
                      )}
                      {hasPermission('stock', 'can_delete') && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => setDeleteTarget(item)}
                          title="Sil"
                          style={{ padding: '5px 8px', fontSize: 12, borderRadius: 6 }}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div style={{ height: 'calc(100vh - 430px)', minHeight: 350 }}>
            <div
              className={theme === 'light' || theme === 'sakura' ? 'ag-theme-quartz' : 'ag-theme-quartz-dark'}
              style={{ height: '100%', width: '100%' }}
            >
              <AgGridReact
                theme="legacy"
                rowData={visibleItems}
                columnDefs={columnDefs}
                defaultColDef={{ resizable: true, sortable: true }}
                rowSelection={{ mode: 'multiRow' }}
                onSelectionChanged={e => setSelectedRows(e.api.getSelectedRows())}
                rowHeight={38}
                headerHeight={38}
                suppressDragLeaveHidesColumns={true}
                pagination
                paginationPageSize={50}
                onRowClicked={params => setSelectedRow(params.data)}
                noRowsOverlayComponent={() => <span>Kayıt bulunamadı.</span>}
              />
            </div>
          </div>
        )}
      </div>

      {/* Alt Durum Şeridi */}
      <div style={{
        display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
        padding: '8px 14px', borderRadius: 8, marginTop: 10,
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        fontSize: 12
      }}>
        <span className="badge badge-secondary">
          Filtre: <b>{stockTypeFilter === 'office' ? '🏢 Ofis Stoğu' : stockTypeFilter === 'scrap' ? '♻️ Hurda Stoğu' : '📋 Tüm Stoklar'}</b>
        </span>
        <span className="badge badge-secondary">Listelenen: <b>{visibleItems.length} / {items.length} Kalem</b></span>
        <span className="badge badge-secondary">Toplam Stok: <b>{totalQty.toFixed(0)} Adet</b></span>
        <span className="badge badge-danger">Kritik Limit: <b>{criticalLow.length} Kalem</b></span>
        <span className="badge badge-success">Stok Değeri: <b>₺{stockValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</b></span>
        {(filterCriticalOnly || stockTypeFilter !== 'all') && (
          <button className="btn btn-link btn-xs" style={{ marginLeft: 'auto' }} onClick={() => { setFilterCriticalOnly(false); setStockTypeFilter('all'); }}>
            Filtreleri Sıfırla
          </button>
        )}
      </div>

      {showForm && (
        <Modal isOpen title={editItem ? '✏️ Ürünü Düzenle' : '📦 Yeni Ürün'} size="lg" onClose={() => setShowForm(false)}>
          <div className="form-grid-3" style={{ padding: 15 }}>
            {/* Stok Türü Seçimi */}
            <div className="form-group form-col-span-3">
              <label style={{ fontWeight: 700, marginBottom: 8, display: 'block' }}>Stok Türü / Kullanım Alanı</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                <div
                  onClick={() => setForm(f => ({ ...f, stock_type: 'office' }))}
                  style={{
                    border: `2px solid ${form.stock_type !== 'scrap' ? '#0284c7' : 'var(--color-border)'}`,
                    background: form.stock_type !== 'scrap' ? 'rgba(14, 165, 233, 0.1)' : 'var(--color-surface-alt)',
                    borderRadius: 8,
                    padding: '10px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <input
                    type="radio"
                    name="modal_stock_type"
                    checked={form.stock_type !== 'scrap'}
                    onChange={() => setForm(f => ({ ...f, stock_type: 'office' }))}
                    style={{ cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: form.stock_type !== 'scrap' ? '#0284c7' : 'var(--color-text)' }}>
                      🏢 Ofis / Aktif Malzeme
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      Ofiste kullanılan, eldeki aktif demirbaş ve sarf malzemeleri
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => setForm(f => ({ ...f, stock_type: 'scrap' }))}
                  style={{
                    border: `2px solid ${form.stock_type === 'scrap' ? '#ef4444' : 'var(--color-border)'}`,
                    background: form.stock_type === 'scrap' ? 'rgba(239, 68, 68, 0.1)' : 'var(--color-surface-alt)',
                    borderRadius: 8,
                    padding: '10px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <input
                    type="radio"
                    name="modal_stock_type"
                    checked={form.stock_type === 'scrap'}
                    onChange={() => setForm(f => ({ ...f, stock_type: 'scrap' }))}
                    style={{ cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: form.stock_type === 'scrap' ? '#ef4444' : 'var(--color-text)' }}>
                      ♻️ Hurda Stoğu (Depo)
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      Depodaki hurdalar, arızalı/ayrılmış parçalar ve e-atıklar
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>Stok Kodu</label>
              <input type="text" className="form-control" value={form.stock_code} onChange={e => setForm({ ...form, stock_code: e.target.value })} readOnly={!!editItem} />
            </div>
            <div className="form-group">
              <label>Barkod Numarası</label>
              <input type="text" className="form-control" value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} placeholder="Boş bırakılırsa stok kodu kullanılır" />
            </div>
            <div className="form-group">
              <label className="required">Ürün Adı</label>
              <input type="text" className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus />
            </div>
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label style={{ margin: 0 }}>Kategori</label>
                <span
                  style={{ fontSize: 10, color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600 }}
                  onClick={() => openTab({ id: 'settings', label: 'Ayarlar', icon: '⚙️', module: 'Settings' })}
                  title="Kategorileri Ayarlar menüsünden yönetin"
                >
                  ⚙️ Yönet
                </span>
              </div>
              <select className="form-control" value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
                <option value="">— Seç —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Birim</label>
              <select className="form-control" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Kritik Seviye</label>
              <input type="number" className="form-control" min="0" value={form.critical_qty} onChange={e => setForm({ ...form, critical_qty: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Birim Fiyat (₺)</label>
              <input type="number" className="form-control" min="0" step="0.01" value={form.unit_price} onChange={e => setForm({ ...form, unit_price: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Raf / Depo</label>
              <input type="text" className="form-control" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
            </div>
            {!editItem && (
              <div className="form-group">
                <label>Başlangıç Stoku</label>
                <input type="number" className="form-control" min="0" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} />
              </div>
            )}
            {editItem && (
              <div className="form-group">
                <label>Mevcut Stok</label>
                <input type="text" className="form-control" value={`${form.qty} ${form.unit}`} disabled />
              </div>
            )}
            <div className="form-group form-col-span-3">
              <label>Açıklama</label>
              <textarea className="form-control" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <div className="flex-gap" style={{ justifyContent: 'flex-end', padding: '0 15px 15px' }}>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>İptal</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? '⏳ Kaydediliyor...' : '💾 Kaydet'}
            </button>
          </div>
        </Modal>
      )}

      {adjustTarget && (
        <Modal isOpen title={`Stok Hareketi: ${adjustTarget.name}`} size="sm" onClose={() => setAdjustTarget(null)}>
          <div style={{ padding: 15 }}>
            <div style={{ marginBottom: 15, padding: 12, background: 'var(--color-surface-alt)', borderRadius: 8, fontSize: 13, border: '1px solid var(--color-border)' }}>
              Mevcut Stok: <strong>{adjustTarget.qty} {adjustTarget.unit}</strong>
            </div>
            <div className="form-group">
              <label>İşlem Türü</label>
              <select className="form-control" value={adjustType} onChange={e => setAdjustType(e.target.value)}>
                <option value="add">➕ Stok Giriş (üzerine ekle)</option>
                <option value="sub">➖ Stok Çıkış (azalt)</option>
                <option value="set">📝 Değer Ata (sayım)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Miktar ({adjustTarget.unit})</label>
              <input type="number" className="form-control" min="0" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} autoFocus />
            </div>
            <div className="form-group">
              <label>Not</label>
              <input type="text" className="form-control" value={adjustNote} onChange={e => setAdjustNote(e.target.value)} placeholder="örn: fatura no, sayım notu..." />
            </div>
            <div className="flex-gap" style={{ justifyContent: 'flex-end', marginTop: 15 }}>
              <button className="btn btn-secondary" onClick={() => setAdjustTarget(null)}>İptal</button>
              <button className="btn btn-primary" onClick={doAdjust}>Uygula</button>
            </div>
          </div>
        </Modal>
      )}

      {checkout && (
        <Modal isOpen title={`🚚 Teslim: ${checkout.name}`} size="sm" onClose={() => setCheckout(null)}>
          <div style={{ padding: 15 }}>
            <div style={{ marginBottom: 12 }}>
              <span className="badge badge-secondary">{checkout.barcode || checkout.stock_code}</span>
              <span className="badge" style={{ background: checkout.qty <= checkout.critical_qty ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)', color: checkout.qty <= checkout.critical_qty ? 'var(--color-danger)' : '#10b981' }}>
                Mevcut: {checkout.qty} {checkout.unit}
              </span>
            </div>
            <div className="form-group">
              <label>Miktar</label>
              <input type="number" className="form-control" min="1" value={chkQty} onChange={e => setChkQty(e.target.value)} autoFocus />
            </div>
            <div className="form-group">
              <label>Teslim Edilen Kişi</label>
              <input type="text" className="form-control" list="stock-checkout-users" value={chkUser} onChange={e => setChkUser(e.target.value)} placeholder="Adı yazın veya seçin" />
              <datalist id="stock-checkout-users">
                {users.map(u => <option key={u.id} value={u.full_name} />)}
              </datalist>
            </div>
            <div className="form-group">
              <label>Not</label>
              <input type="text" className="form-control" value={chkNote} onChange={e => setChkNote(e.target.value)} placeholder="örn: servis fiş no, adres..." />
            </div>
            <div className="flex-gap" style={{ justifyContent: 'flex-end', marginTop: 15 }}>
              <button className="btn btn-secondary" onClick={() => setCheckout(null)}>İptal</button>
              <button className="btn btn-primary" onClick={doCheckout}>✅ Teslim Et ve Stoktan Düş</button>
            </div>
          </div>
        </Modal>
      )}

      {labelTarget && (
        <Modal isOpen title="🏷️ Etiket Yazdır (Görünüm)" size="sm" onClose={() => setLabelTarget(null)}>
          <div style={{ padding: 15, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className={labelMode === 'barcode' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} onClick={() => setLabelMode('barcode')}>Barkod</button>
              <button className={labelMode === 'qr' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} onClick={() => setLabelMode('qr')}>QR Kod</button>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700 }}>{labelTarget.name}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                {labelTarget.category_name || ''} {labelTarget.location ? '• ' + labelTarget.location : ''}
              </div>
              <div style={{ fontSize: 12, marginTop: 4 }}>{labelTarget.barcode || labelTarget.stock_code}</div>
            </div>
            <QRCodePreview code={labelTarget.barcode || labelTarget.stock_code || String(labelTarget.id)} mode={labelMode} />
            <button className="btn btn-primary" onClick={printLabel}>🖨️ Yazdır</button>
          </div>
        </Modal>
      )}

      {movementsFor && (
        <Modal isOpen title={`📋 Hareket Geçmişi: ${movementsFor.name}`} size="lg" onClose={() => setMovementsFor(null)}>
          <div style={{ padding: 15 }}>
            {movLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>Yükleniyor...</div>
            ) : movements.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>Hareket kaydı bulunamadı.</div>
            ) : (
              <table className="data-grid-table">
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>Tür</th>
                    <th>Miktar</th>
                    <th>Teslim Edilen</th>
                    <th>Not</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map(m => (
                    <tr key={m.id}>
                      <td>{m.move_date}</td>
                      <td>
                        <span className={`badge ${m.move_type === 'Giriş' ? 'badge-success' : m.move_type === 'Çıkış' ? 'badge-danger' : 'badge-warning'}`}>
                          {m.move_type}
                        </span>
                      </td>
                      <td>{m.qty}</td>
                      <td>{m.receiver || '—'}</td>
                      <td>{m.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Ürünü Kaldır"
          message={`"${deleteTarget.name}" stoktan kaldırılacak. Emin misiniz?`}
          onConfirm={doDelete}
          onCancel={() => setDeleteTarget(null)}
          type="danger"
        />
      )}

      {confirmDeleteSelected && selectedRows.length > 0 && (
        <ConfirmDialog
          title="Seçilenleri Sil"
          message={`${selectedRows.length} stok kalemi silinecek. Emin misiniz?`}
          onConfirm={() => { deleteSelected(); setConfirmDeleteSelected(false); }}
          onCancel={() => setConfirmDeleteSelected(false)}
          type="danger"
        />
      )}
    </div>
  );
}

function QRCodePreview({ code, mode }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (mode === 'qr' && canvasRef.current && code) {
      QRCode.toCanvas(canvasRef.current, code, { width: 160, margin: 1 })
        .catch(() => {});
    }
  }, [code, mode]);
  const svgRef = useRef(null);
  useEffect(() => {
    if (mode === 'barcode' && svgRef.current && code) {
      try {
        JsBarcode(svgRef.current, code, { format: 'CODE128', width: 2, height: 60, displayValue: true, margin: 4 });
      } catch (_) {}
    }
  }, [code, mode]);
  if (mode === 'qr') {
    return (
      <div style={{ padding: 12, border: '1px solid var(--color-border)', borderRadius: 8, background: '#fff' }}>
        <canvas ref={canvasRef} style={{ width: 160, height: 160 }} />
      </div>
    );
  }
  return (
    <div style={{ padding: 12, border: '1px solid var(--color-border)', borderRadius: 8, background: '#fff' }}>
      <svg ref={svgRef} style={{ width: 260 }} />
    </div>
  );
}