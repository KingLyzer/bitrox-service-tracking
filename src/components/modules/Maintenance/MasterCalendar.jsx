import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../../../context/AppContext';
import Modal from '../../common/Modal';
import ServiceTicketDetail from '../ServiceTickets/ServiceTicketDetail';
import CargoDetailModal from '../Cargo/CargoDetailModal';
import '../../../styles/masterCalendar.css';

const MONTH_NAMES_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

const WEEKDAY_NAMES_TR = [
  'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'
];

const NOTE_COLORS = [
  { id: 'red', label: 'Acil / Önemli', bg: '#ef4444', text: '#fee2e2' },
  { id: 'blue', label: 'Bilgi / Görev', bg: '#3b82f6', text: '#dbeafe' },
  { id: 'green', label: 'Kişisel / Rutin', bg: '#10b981', text: '#d1fae5' },
  { id: 'orange', label: 'Hatırlatma', bg: '#f59e0b', text: '#fef3c7' },
  { id: 'purple', label: 'Proje / Toplantı', bg: '#a855f7', text: '#f3e8ff' },
  { id: 'rose', label: 'Özel Not', bg: '#f43f5e', text: '#ffe4e6' },
];

// Yerel saat dilimine göre YYYY-MM-DD anahtarı üretir (UTC kaymasını engeller)
const toLocalDateKey = (date) => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function MasterCalendar({
  initialDate,
  autoOpenSummary = false,
  onSelectPlan,
  currentUser
}) {
  const { showNotification, theme, refreshToggle, openTab } = useApp();

  // Aktif Ay & Yıl
  const todayStr = useMemo(() => toLocalDateKey(new Date()), []);
  const initialDateObj = useMemo(() => {
    if (initialDate && !isNaN(new Date(initialDate).getTime())) {
      return new Date(initialDate);
    }
    return new Date();
  }, [initialDate]);

  const [currentYear, setCurrentYear] = useState(initialDateObj.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(initialDateObj.getMonth()); // 0-indexed

  // Seçili Gün & Günlük Özet Paneli (Varsayılan KAPALI, sadece autoOpenSummary ile açık gelir)
  const [selectedDate, setSelectedDate] = useState(() => initialDate || todayStr);
  const [isSummaryOpen, setIsSummaryOpen] = useState(() => Boolean(autoOpenSummary));

  // Modül Filtreleri (Onay Kutuları)
  const [filters, setFilters] = useState({
    service: true,
    maintenance: true,
    cargo: true,
    toner: true,
    note: true
  });

  // Ham Veriler
  const [loading, setLoading] = useState(false);
  const [eventsData, setEventsData] = useState({
    tickets: [],
    cargo: [],
    toner: [],
    maintenancePlans: [],
    maintenanceChecks: [],
    notes: []
  });

  // Modal Durumları
  const [detailTicket, setDetailTicket] = useState(null);
  const [detailCargo, setDetailCargo] = useState(null);
  const [detailToner, setDetailToner] = useState(null);

  // Kişisel Not Modal Durumları
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [editNote, setEditNote] = useState(null);
  const [noteForm, setNoteForm] = useState({
    title: '',
    description: '',
    note_date: todayStr,
    color: 'blue'
  });
  const [savingNote, setSavingNote] = useState(false);

  // Veri Çekme
  const fetchCalendarData = useCallback(async () => {
    setLoading(true);
    try {
      const start = toLocalDateKey(new Date(currentYear, currentMonth - 1, 1));
      const end = toLocalDateKey(new Date(currentYear, currentMonth + 2, 0));

      let res;
      if (window.electronAPI?.getMasterCalendarEvents) {
        res = await window.electronAPI.getMasterCalendarEvents(`start=${start}&end=${end}`);
      } else {
        const queryParams = new URLSearchParams({ start, end });
        const response = await fetch(`/api/maintenance/master-calendar?${queryParams}`);
        res = await response.json();
      }

      if (res?.success) {
        setEventsData({
          tickets: res.tickets || [],
          cargo: res.cargo || [],
          toner: res.toner || [],
          maintenancePlans: res.maintenancePlans || [],
          maintenanceChecks: res.maintenanceChecks || [],
          notes: res.notes || []
        });
      } else {
        showNotification?.('Takvim verileri yüklenemedi: ' + (res?.message || ''), 'warning');
      }
    } catch (err) {
      console.error('Master calendar fetch error:', err);
      showNotification?.('Takvim verileri alınamadı: ' + err.message, 'danger');
    } finally {
      setLoading(false);
    }
  }, [currentYear, currentMonth, showNotification]);

  useEffect(() => {
    fetchCalendarData();
  }, [fetchCalendarData, refreshToggle]);

  // initialDate veya autoOpenSummary prop'ları değişirse
  useEffect(() => {
    if (initialDate) {
      const d = new Date(initialDate);
      if (!isNaN(d.getTime())) {
        setCurrentYear(d.getFullYear());
        setCurrentMonth(d.getMonth());
        setSelectedDate(initialDate);
        if (autoOpenSummary) setIsSummaryOpen(true);
      }
    }
  }, [initialDate, autoOpenSummary]);

  // Ay Değiştirme Fonksiyonları
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
    setSelectedDate(todayStr);
    setIsSummaryOpen(true);
  };

  // Kişisel Not Kaydetme (Ekle / Güncelle)
  const handleSaveNote = async (e) => {
    e.preventDefault();
    if (!noteForm.title.trim() || !noteForm.note_date) {
      showNotification?.('Lütfen başlık ve tarih belirtiniz.', 'warning');
      return;
    }
    setSavingNote(true);
    try {
      const url = editNote ? `/api/maintenance/notes/${editNote.id}` : '/api/maintenance/notes';
      const method = editNote ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...noteForm,
          user_id: currentUser?.id,
          user_name: currentUser?.full_name || currentUser?.username || 'IT Personeli'
        })
      }).then(r => r.json());

      if (res?.success) {
        showNotification?.(editNote ? 'Not güncellendi.' : 'Yeni not eklendi.', 'success');
        setShowNoteModal(false);
        setEditNote(null);
        fetchCalendarData();
      } else {
        showNotification?.('Hata: ' + (res?.message || ''), 'danger');
      }
    } catch (err) {
      showNotification?.('Not kaydedilemedi: ' + err.message, 'danger');
    } finally {
      setSavingNote(false);
    }
  };

  // Kişisel Not Silme
  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('Bu notu silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/maintenance/notes/${noteId}`, { method: 'DELETE' }).then(r => r.json());
      if (res?.success) {
        showNotification?.('Not silindi.', 'success');
        setShowNoteModal(false);
        setEditNote(null);
        fetchCalendarData();
      } else {
        showNotification?.('Hata: ' + (res?.message || ''), 'danger');
      }
    } catch (err) {
      showNotification?.('Not silinemedi: ' + err.message, 'danger');
    }
  };

  // Not Düzenleme Penceresini Açma
  const openEditNote = (note) => {
    setEditNote(note);
    setNoteForm({
      title: note.title || '',
      description: note.description || '',
      note_date: note.note_date ? String(note.note_date).slice(0, 10) : todayStr,
      color: note.color || 'blue'
    });
    setShowNoteModal(true);
  };

  // Yeni Not Ekleme Penceresini Açma
  const openCreateNote = (targetDate = null) => {
    setEditNote(null);
    setNoteForm({
      title: '',
      description: '',
      note_date: targetDate || selectedDate || todayStr,
      color: 'blue'
    });
    setShowNoteModal(true);
  };

  // Tüm Verileri Tarihe Göre Gruplama
  const eventsByDate = useMemo(() => {
    const map = {};

    const addToMap = (dateStr, item) => {
      if (!dateStr) return;
      let key = '';
      if (typeof dateStr === 'string') {
        if (dateStr.includes('T')) {
          const d = new Date(dateStr);
          key = !isNaN(d.getTime()) ? toLocalDateKey(d) : dateStr.slice(0, 10);
        } else {
          key = dateStr.slice(0, 10);
        }
      } else if (dateStr instanceof Date) {
        key = toLocalDateKey(dateStr);
      }
      if (!key) return;
      if (!map[key]) {
        map[key] = {
          service: [],
          maintenance: [],
          cargo: [],
          toner: [],
          note: [],
          all: []
        };
      }
      map[key][item.type].push(item);
      map[key].all.push(item);
    };

    // 1. Servis Fişleri (Mavi)
    eventsData.tickets.forEach(t => {
      const dateStr = t.created_at;
      addToMap(dateStr, {
        id: `srv-${t.id}`,
        type: 'service',
        category: 'Servis Fişi',
        title: `🔧 [${t.ticket_no}] ${t.customer_name || t.company_name || 'Servis Kaydı'}`,
        shortTitle: `${t.ticket_no} • ${t.customer_name || t.company_name || 'Cihaz'}`,
        subtitle: t.device_name ? `${t.device_name} • ${t.fault_description || ''}` : t.fault_description,
        status: t.status,
        priority: t.priority,
        raw: t
      });
    });

    // 2. Kargo Hareketleri (Turuncu)
    eventsData.cargo.forEach(c => {
      const dateStr = c.received_date || c.created_at;
      const isOut = c.direction === 'outgoing';
      addToMap(dateStr, {
        id: `cargo-${c.id}`,
        type: 'cargo',
        category: isOut ? 'Giden Kargo' : 'Gelen Kargo',
        title: `📦 ${isOut ? 'Giden' : 'Gelen'}: ${c.carrier} • ${isOut ? (c.recipient_name || 'Alıcı') : (c.sender || c.recipient_name || 'Gönderen')}`,
        shortTitle: `${isOut ? '📤' : '📥'} ${c.carrier} • ${c.recipient_name || c.sender || 'Kargo'}`,
        subtitle: `${c.package_type || 'Kargo'} • Takip: ${c.tracking_number || 'Belirtilmedi'}`,
        status: c.status,
        raw: c
      });
    });

    // 3. Toner Teslimatları (Mor)
    eventsData.toner.forEach(tn => {
      const dateStr = tn.change_date;
      addToMap(dateStr, {
        id: `toner-${tn.id}`,
        type: 'toner',
        category: 'Toner Teslimatı',
        title: `🖨️ ${tn.toner_model || 'Toner'} (${tn.qty || 1} Adet) • ${tn.target_name || tn.assigned_user || 'Birim'}`,
        shortTitle: `🖨️ ${tn.toner_model || 'Toner'} (${tn.qty || 1} Ad.)`,
        subtitle: `Teslim: ${tn.target_name || tn.assigned_user || '—'} ${tn.notes ? `• ${tn.notes}` : ''}`,
        raw: tn
      });
    });

    // 4. Periyodik Bakım Planları (Yeşil)
    eventsData.maintenancePlans.forEach(mp => {
      const dateStr = mp.planned_date;
      addToMap(dateStr, {
        id: `plan-${mp.id}`,
        type: 'maintenance',
        category: 'Periyodik Bakım Planı',
        title: `🛡️ Bakım: ${mp.title} (${mp.company_name})`,
        shortTitle: `🛡️ Bakım: ${mp.company_name}`,
        subtitle: `Dönem: ${mp.period} • Tamamlanan: ${mp.completed_devices || 0} / ${mp.total_devices || 0}`,
        status: mp.status,
        raw: mp,
        isPlan: true
      });
    });

    // 5. Tamamlanan Cihaz Bakımları (Yeşil)
    eventsData.maintenanceChecks.forEach(mc => {
      const dateStr = mc.completed_at;
      addToMap(dateStr, {
        id: `check-${mc.id}`,
        type: 'maintenance',
        category: 'Tamamlanan Cihaz Bakımı',
        title: `🛡️ ${mc.asset_tag || 'Cihaz'} Bakımı: ${mc.company_name || mc.plan_title}`,
        shortTitle: `🛡️ ${mc.asset_tag} (${mc.model_name || 'PC'})`,
        subtitle: `Personel: ${mc.assigned_user || '—'} • Teknisyen: ${mc.tech_name || '—'}`,
        status: mc.status,
        raw: mc,
        isCheck: true
      });
    });

    // 6. Kişisel IT Notları & Hatırlatıcılar (Pembe / Seçilen Renk)
    eventsData.notes?.forEach(n => {
      const dateStr = n.note_date;
      addToMap(dateStr, {
        id: `note-${n.id}`,
        type: 'note',
        category: 'Kişisel Not / Hatırlatıcı',
        title: `📌 ${n.title}`,
        shortTitle: `📌 ${n.title}`,
        subtitle: n.description || '',
        color: n.color || 'blue',
        raw: n
      });
    });

    return map;
  }, [eventsData]);

  // Ay Filtresi Sayaçları
  const monthCounts = useMemo(() => {
    let service = 0;
    let maintenance = 0;
    let cargo = 0;
    let toner = 0;
    let note = 0;

    const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

    Object.entries(eventsByDate).forEach(([dateKey, dayData]) => {
      if (dateKey.startsWith(monthPrefix)) {
        service += dayData.service.length;
        maintenance += dayData.maintenance.length;
        cargo += dayData.cargo.length;
        toner += dayData.toner.length;
        note += dayData.note.length;
      }
    });

    return {
      service,
      maintenance,
      cargo,
      toner,
      note,
      total: service + maintenance + cargo + toner + note
    };
  }, [eventsByDate, currentYear, currentMonth]);

  // Takvim Hücrelerini Oluşturma
  const calendarCells = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

    // Pazartesi = 0, Pazar = 6
    let startDayIndex = firstDayOfMonth.getDay() - 1;
    if (startDayIndex === -1) startDayIndex = 6;

    const totalDaysInMonth = lastDayOfMonth.getDate();
    const prevMonthLastDate = new Date(currentYear, currentMonth, 0).getDate();
    const cells = [];

    // Önceki ay dolgu günleri
    for (let i = startDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDate - i;
      const prevDate = new Date(currentYear, currentMonth - 1, dayNum);
      const dateKey = toLocalDateKey(prevDate);
      cells.push({
        date: prevDate,
        dateKey,
        dayNum,
        isOtherMonth: true,
        isToday: dateKey === todayStr
      });
    }

    // Aktif ayın günleri
    for (let dayNum = 1; dayNum <= totalDaysInMonth; dayNum++) {
      const cellDate = new Date(currentYear, currentMonth, dayNum);
      const dateKey = toLocalDateKey(cellDate);
      cells.push({
        date: cellDate,
        dateKey,
        dayNum,
        isOtherMonth: false,
        isToday: dateKey === todayStr
      });
    }

    // Gelecek ay dolgu günleri
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let dayNum = 1; dayNum <= remaining; dayNum++) {
      const nextDate = new Date(currentYear, currentMonth + 1, dayNum);
      const dateKey = toLocalDateKey(nextDate);
      cells.push({
        date: nextDate,
        dateKey,
        dayNum,
        isOtherMonth: true,
        isToday: dateKey === todayStr
      });
    }

    return cells;
  }, [currentYear, currentMonth, todayStr]);

  // Bir Günün Filtrelenmiş Etkinliklerini Alma
  const getFilteredDayEvents = useCallback((dateKey) => {
    const dayData = eventsByDate[dateKey];
    if (!dayData) return [];

    const activeList = [];
    if (filters.service) activeList.push(...dayData.service);
    if (filters.maintenance) activeList.push(...dayData.maintenance);
    if (filters.cargo) activeList.push(...dayData.cargo);
    if (filters.toner) activeList.push(...dayData.toner);
    if (filters.note) activeList.push(...dayData.note);

    return activeList;
  }, [eventsByDate, filters]);

  // Hücreye Tıklama: Tarihi seçer ve Günlük Özet Panelini açar!
  const handleDayClick = (dateKey) => {
    setSelectedDate(dateKey);
    setIsSummaryOpen(true);
  };

  // Etkinliğe Tıklama
  const handleEventClick = (e, item) => {
    e.stopPropagation();
    if (item.type === 'service') {
      setDetailTicket(item.raw);
    } else if (item.type === 'cargo') {
      setDetailCargo(item.raw);
    } else if (item.type === 'maintenance') {
      if (item.isPlan && onSelectPlan) {
        onSelectPlan(item.raw.id);
      } else {
        setSelectedDate(item.raw.planned_date || item.raw.completed_at?.slice(0, 10));
        setIsSummaryOpen(true);
      }
    } else if (item.type === 'toner') {
      setDetailToner(item.raw);
    } else if (item.type === 'note') {
      openEditNote(item.raw);
    }
  };

  // Seçili Günün Verileri
  const selectedDayData = useMemo(() => {
    if (!selectedDate) return null;
    return eventsByDate[selectedDate] || { service: [], maintenance: [], cargo: [], toner: [], note: [], all: [] };
  }, [selectedDate, eventsByDate]);

  // Seçili Gün Başlığı (Türkçe format)
  const formattedSelectedDate = useMemo(() => {
    if (!selectedDate) return '';
    try {
      const [y, m, d] = selectedDate.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return `${d} ${MONTH_NAMES_TR[m - 1]} ${y} ${WEEKDAY_NAMES_TR[(dateObj.getDay() + 6) % 7]}`;
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  return (
    <div className="master-calendar-wrapper">
      {/* ── Üst Bar & Filtre Kontrolleri ───────────────────────────────── */}
      <div className="calendar-top-bar">
        {/* Ay & Yıl Navigasyonu */}
        <div className="calendar-nav-group">
          <button
            className="btn btn-secondary btn-sm"
            onClick={handlePrevMonth}
            title="Önceki Ay"
            style={{ padding: '5px 10px', fontSize: 13, fontWeight: 700 }}
          >
            ◀
          </button>

          <div className="calendar-month-title">
            <span>🗓️</span>
            <span>{MONTH_NAMES_TR[currentMonth]} {currentYear}</span>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={handleNextMonth}
            title="Sonraki Ay"
            style={{ padding: '5px 10px', fontSize: 13, fontWeight: 700 }}
          >
            ▶
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={handleToday}
            style={{ fontSize: 11.5, fontWeight: 700, padding: '5px 12px', marginLeft: 4 }}
          >
            Bugün
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={fetchCalendarData}
            title="Takvimi Yenile"
            style={{ padding: '5px 8px', fontSize: 12 }}
          >
            {loading ? '⏳' : '🔄'}
          </button>
        </div>

        {/* ── Renk Kodlu Modül Filtreleri (Checkbox / Pill) ─────────────── */}
        <div className="calendar-filter-pills">
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', marginRight: 2 }}>
            FİLTRELER:
          </span>

          {/* Servis Fişleri - Mavi */}
          <div
            className={`calendar-filter-pill service ${filters.service ? 'active' : ''}`}
            onClick={() => setFilters(prev => ({ ...prev, service: !prev.service }))}
            title="Servis Fişlerini Göster / Gizle"
          >
            <span>{filters.service ? '☑️' : '◻️'}</span>
            <span>🔧 Servis Fişleri</span>
            <span className="pill-count">{monthCounts.service}</span>
          </div>

          {/* Periyodik Bakım - Yeşil */}
          <div
            className={`calendar-filter-pill maintenance ${filters.maintenance ? 'active' : ''}`}
            onClick={() => setFilters(prev => ({ ...prev, maintenance: !prev.maintenance }))}
            title="Periyodik Bakımları Göster / Gizle"
          >
            <span>{filters.maintenance ? '☑️' : '◻️'}</span>
            <span>🛡️ Periyodik Bakım</span>
            <span className="pill-count">{monthCounts.maintenance}</span>
          </div>

          {/* Kargo Takip - Turuncu */}
          <div
            className={`calendar-filter-pill cargo ${filters.cargo ? 'active' : ''}`}
            onClick={() => setFilters(prev => ({ ...prev, cargo: !prev.cargo }))}
            title="Kargo Hareketlerini Göster / Gizle"
          >
            <span>{filters.cargo ? '☑️' : '◻️'}</span>
            <span>📦 Kargo Hareketleri</span>
            <span className="pill-count">{monthCounts.cargo}</span>
          </div>

          {/* Toner Teslimatları - Mor */}
          <div
            className={`calendar-filter-pill toner ${filters.toner ? 'active' : ''}`}
            onClick={() => setFilters(prev => ({ ...prev, toner: !prev.toner }))}
            title="Toner Teslimatlarını Göster / Gizle"
          >
            <span>{filters.toner ? '☑️' : '◻️'}</span>
            <span>🖨️ Toner Teslimatları</span>
            <span className="pill-count">{monthCounts.toner}</span>
          </div>

          {/* Kişisel Notlar & Hatırlatıcılar - Pembe / Kırmızı */}
          <div
            className={`calendar-filter-pill note ${filters.note ? 'active' : ''}`}
            onClick={() => setFilters(prev => ({ ...prev, note: !prev.note }))}
            title="Kişisel IT Notlarını Göster / Gizle"
          >
            <span>{filters.note ? '☑️' : '◻️'}</span>
            <span>📌 Kişisel Notlar</span>
            <span className="pill-count">{monthCounts.note}</span>
          </div>

          {/* Tümünü Aç / Kapat */}
          <button
            className="btn btn-secondary btn-xs"
            onClick={() => {
              const allActive = filters.service && filters.maintenance && filters.cargo && filters.toner && filters.note;
              setFilters({
                service: !allActive,
                maintenance: !allActive,
                cargo: !allActive,
                toner: !allActive,
                note: !allActive
              });
            }}
            style={{ fontSize: 10, padding: '3px 8px', marginLeft: 2 }}
          >
            {filters.service && filters.maintenance && filters.cargo && filters.toner && filters.note ? 'Tümünü Kapat' : 'Tümünü Aç'}
          </button>
        </div>

        {/* ── Sağ Aksiyonlar: Not Ekle & Günlük Rapor Aç/Kapat ──────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => openCreateNote()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 11.5, padding: '5px 12px' }}
            title="Takvime Yeni Kişisel Not veya Hatırlatıcı Ekle"
          >
            <span>📌</span> Not Ekle
          </button>

          <button
            className={`btn btn-sm ${isSummaryOpen ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setIsSummaryOpen(!isSummaryOpen)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 11.5, padding: '5px 12px' }}
            title="Günlük Operasyon Raporunu Aç / Kapat"
          >
            <span>📋</span> {isSummaryOpen ? 'Paneli Gizle' : 'Günlük Rapor'}
          </button>
        </div>
      </div>

      {/* ── Ana İçerik: Takvim Grid'i + Sağ Günlük Özet Paneli ─────────── */}
      <div className="calendar-main-content">
        {/* Takvim Alanı (Panel kapalıyken %100 tam ekran) */}
        <div className="calendar-grid-area">
          {/* Hafta Günleri Başlıkları */}
          <div className="calendar-weekdays-row">
            {WEEKDAY_NAMES_TR.map((dayName, idx) => (
              <div key={dayName} className={`calendar-weekday-cell ${idx >= 5 ? 'weekend' : ''}`}>
                {dayName}
              </div>
            ))}
          </div>

          {/* Gün Hücreleri Grid'i */}
          <div className="calendar-days-grid">
            {calendarCells.map(cell => {
              const dayEvents = getFilteredDayEvents(cell.dateKey);
              const isSelected = selectedDate === cell.dateKey;
              const hasEvents = dayEvents.length > 0;
              const maxDisplayEvents = 3;
              const visibleEvents = dayEvents.slice(0, maxDisplayEvents);
              const remainingCount = dayEvents.length - maxDisplayEvents;

              return (
                <div
                  key={cell.dateKey}
                  className={`calendar-day-cell ${cell.isOtherMonth ? 'other-month' : ''} ${cell.isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => handleDayClick(cell.dateKey)}
                  title={`${cell.dateKey} (${dayEvents.length} kayıt)`}
                >
                  {/* Gün Başlığı */}
                  <div className="day-cell-header">
                    <span className="day-number">{cell.dayNum}</span>
                    {hasEvents && (
                      <span className="day-event-count">
                        {dayEvents.length} kayıt
                      </span>
                    )}
                  </div>

                  {/* Etkinlik Badgeleri */}
                  <div className="day-events-list">
                    {visibleEvents.map(evt => (
                      <div
                        key={evt.id}
                        className={`calendar-event-badge ${evt.type} ${evt.color || ''}`}
                        onClick={(e) => handleEventClick(e, evt)}
                        title={`${evt.category}: ${evt.title}\n${evt.subtitle || ''}`}
                      >
                        <span>{evt.shortTitle}</span>
                      </div>
                    ))}

                    {/* "+X daha" kısaltması */}
                    {remainingCount > 0 && (
                      <div
                        className="more-events-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDayClick(cell.dateKey);
                        }}
                      >
                        +{remainingCount} daha
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Günlük Özet Raporu (Açılır / Kapanır Sağ Panel) ─────────────── */}
        {isSummaryOpen && selectedDayData && (
          <div className="daily-summary-panel">
            {/* Panel Başlığı */}
            <div className="summary-header">
              <div>
                <h3 className="summary-header-title">
                  <span>📅</span> Günlük Operasyon Raporu
                </h3>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', marginTop: 2 }}>
                  {formattedSelectedDate}
                </div>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setIsSummaryOpen(false)}
                title="Paneli Kapat"
                style={{ padding: '4px 8px', fontSize: 13 }}
              >
                ✕
              </button>
            </div>

            {/* Panel Gövdesi */}
            <div className="summary-body">
              {/* 0. Kişisel IT Notları & Hatırlatıcılar */}
              <div className="summary-section">
                <div className="summary-section-title note">
                  <span>📌 Kişisel Notlar & Hatırlatıcılar</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="badge" style={{ background: '#f43f5e', color: '#fff' }}>{selectedDayData.note.length}</span>
                    <button
                      className="btn btn-secondary btn-xs"
                      onClick={() => openCreateNote(selectedDate)}
                      style={{ fontSize: 10, padding: '1px 6px' }}
                      title="Bu Güne Not Ekle"
                    >
                      + Ekle
                    </button>
                  </div>
                </div>

                {selectedDayData.note.length === 0 ? (
                  <div className="summary-empty-text">Bu tarihe ait kişisel not veya hatırlatıcı yok.</div>
                ) : (
                  selectedDayData.note.map(item => (
                    <div
                      key={item.id}
                      className="summary-card"
                      onClick={() => openEditNote(item.raw)}
                      style={{ borderLeft: `3.5px solid ${NOTE_COLORS.find(c => c.id === item.raw.color)?.bg || '#f43f5e'}` }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 800, fontSize: 12.5, color: 'var(--color-text)' }}>
                          📌 {item.raw.title}
                        </span>
                        <span className="badge" style={{
                          background: NOTE_COLORS.find(c => c.id === item.raw.color)?.bg || '#f43f5e',
                          color: '#fff',
                          fontSize: 9.5
                        }}>
                          {NOTE_COLORS.find(c => c.id === item.raw.color)?.label || 'Not'}
                        </span>
                      </div>
                      {item.raw.description && (
                        <div style={{ fontSize: 11.5, color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap' }}>
                          {item.raw.description}
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2, fontSize: 10.5, color: 'var(--color-text-muted)' }}>
                        <span>👤 {item.raw.user_name || 'IT'}</span>
                        <button className="btn btn-secondary btn-xs" style={{ fontSize: 10, padding: '2px 7px' }}>
                          Düzenle ✏️
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* 1. Servis Fişleri */}
              <div className="summary-section">
                <div className="summary-section-title service">
                  <span>🔧 Açılan Servis Kayıtları</span>
                  <span className="badge badge-primary">{selectedDayData.service.length}</span>
                </div>

                {selectedDayData.service.length === 0 ? (
                  <div className="summary-empty-text">Bu tarihte açılan servis kaydı bulunmuyor.</div>
                ) : (
                  selectedDayData.service.map(item => (
                    <div
                      key={item.id}
                      className="summary-card"
                      onClick={() => setDetailTicket(item.raw)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 800, fontSize: 12.5, color: '#3b82f6' }}>
                          {item.raw.ticket_no}
                        </span>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <span className={`badge ${item.raw.priority === 'Kritik' ? 'badge-danger' : item.raw.priority === 'Yüksek' ? 'badge-warning' : 'badge-primary'}`} style={{ fontSize: 10 }}>
                            {item.raw.priority || 'Normal'}
                          </span>
                          <span className="badge badge-secondary" style={{ fontSize: 10 }}>
                            {item.raw.status}
                          </span>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>
                        🏢 {item.raw.customer_name || item.raw.company_name || 'Şirket Belirtilmedi'}
                      </div>
                      {item.raw.device_name && (
                        <div style={{ fontSize: 11.5, color: 'var(--color-text-secondary)' }}>
                          💻 {item.raw.device_name}
                        </div>
                      )}
                      {item.raw.fault_description && (
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          📝 {item.raw.fault_description}
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                        <button className="btn btn-primary btn-xs" style={{ fontSize: 10.5, padding: '2px 8px' }}>
                          Fiş Detayını Gör 👁️
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* 2. Periyodik Bakımlar */}
              <div className="summary-section">
                <div className="summary-section-title maintenance">
                  <span>🛡️ Yapılan / Planlanan Bakımlar</span>
                  <span className="badge badge-success">{selectedDayData.maintenance.length}</span>
                </div>

                {selectedDayData.maintenance.length === 0 ? (
                  <div className="summary-empty-text">Bu tarihte planlı periyodik bakım bulunmuyor.</div>
                ) : (
                  selectedDayData.maintenance.map(item => (
                    <div
                      key={item.id}
                      className="summary-card"
                      onClick={() => {
                        if (item.isPlan && onSelectPlan) {
                          onSelectPlan(item.raw.id);
                        }
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 800, fontSize: 12.5, color: '#10b981' }}>
                          🏢 {item.raw.company_name || item.raw.title}
                        </span>
                        <span className={`badge ${item.raw.status === 'Tamamlandı' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 10 }}>
                          {item.raw.status}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>
                        {item.title}
                      </div>
                      {item.isPlan && (
                        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                          📊 İlerleme: <b>{item.raw.completed_devices || 0} / {item.raw.total_devices || 0}</b> Cihaz
                        </div>
                      )}
                      {item.isCheck && (
                        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                          💻 Cihaz: <b>{item.raw.asset_tag}</b> ({item.raw.model_name || 'PC'}) • Personel: {item.raw.assigned_user || '—'}
                        </div>
                      )}
                      {item.isPlan && onSelectPlan && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                          <button className="btn btn-success btn-xs" style={{ fontSize: 10.5, padding: '2px 8px' }}>
                            Cihaz Listesi & Bakım 🔍
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* 3. Kargo Hareketleri */}
              <div className="summary-section">
                <div className="summary-section-title cargo">
                  <span>📦 Gelen & Giden Kargolar</span>
                  <span className="badge badge-warning">{selectedDayData.cargo.length}</span>
                </div>

                {selectedDayData.cargo.length === 0 ? (
                  <div className="summary-empty-text">Bu tarihte kargo hareketi kaydedilmemiş.</div>
                ) : (
                  selectedDayData.cargo.map(item => {
                    const isOut = item.raw.direction === 'outgoing';
                    return (
                      <div
                        key={item.id}
                        className="summary-card"
                        onClick={() => setDetailCargo(item.raw)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className={`badge ${isOut ? 'badge-primary' : 'badge-warning'}`} style={{ fontSize: 10 }}>
                            {isOut ? '📤 Giden Kargo' : '📥 Gelen Kargo'}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text)' }}>
                            🚚 {item.raw.carrier}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>
                          {isOut ? `Alıcı: ${item.raw.recipient_name || '—'}` : `Gönderen: ${item.raw.sender || item.raw.recipient_name || '—'}`}
                        </div>
                        {item.raw.tracking_number && (
                          <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-primary)' }}>
                            🔖 Takip: {item.raw.tracking_number}
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                          <span style={{ fontSize: 10.5, color: 'var(--color-text-muted)' }}>
                            {item.raw.package_type || 'Koli / Paket'}
                          </span>
                          <button className="btn btn-warning btn-xs" style={{ fontSize: 10.5, padding: '2px 8px' }}>
                            Kargo Detayı 📦
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* 4. Toner Teslimatları */}
              <div className="summary-section">
                <div className="summary-section-title toner">
                  <span>🖨️ Toner Teslimatları</span>
                  <span className="badge" style={{ background: '#a855f7', color: '#fff' }}>{selectedDayData.toner.length}</span>
                </div>

                {selectedDayData.toner.length === 0 ? (
                  <div className="summary-empty-text">Bu tarihte toner sarf çıkışı yapılmamış.</div>
                ) : (
                  selectedDayData.toner.map(item => (
                    <div
                      key={item.id}
                      className="summary-card"
                      onClick={() => setDetailToner(item.raw)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 800, fontSize: 12.5, color: '#a855f7' }}>
                          🖨️ {item.raw.toner_model || 'Toner Modeli'}
                        </span>
                        <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', fontSize: 10 }}>
                          {item.raw.qty || 1} Adet
                        </span>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>
                        👤 Teslim: {item.raw.target_name || item.raw.assigned_user || '—'}
                      </div>
                      {item.raw.asset_name && (
                        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                          💻 Yazıcı: {item.raw.asset_name}
                        </div>
                      )}
                      {item.raw.notes && (
                        <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                          📝 {item.raw.notes}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Kişisel Not Ekleme / Düzenleme Modalı ───────────────────────── */}
      {showNoteModal && (
        <Modal
          isOpen={true}
          title={editNote ? '📌 Kişisel Notu Düzenle' : '📌 Yeni Kişisel Not / Hatırlatıcı Ekle'}
          size="md"
          onClose={() => { setShowNoteModal(false); setEditNote(null); }}
        >
          <form onSubmit={handleSaveNote} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                Not Başlığı *
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Örn: Sunucu yedeklerini kontrol et, Lisans yenilemesi..."
                value={noteForm.title}
                onChange={e => setNoteForm({ ...noteForm, title: e.target.value })}
                required
                autoFocus
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                  Tarih *
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={noteForm.note_date}
                  onChange={e => setNoteForm({ ...noteForm, note_date: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                  Renk / Kategori *
                </label>
                <select
                  className="form-control"
                  value={noteForm.color}
                  onChange={e => setNoteForm({ ...noteForm, color: e.target.value })}
                >
                  {NOTE_COLORS.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Renk Önizleme Paleti */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Renk Seç:</span>
              {NOTE_COLORS.map(c => (
                <div
                  key={c.id}
                  onClick={() => setNoteForm({ ...noteForm, color: c.id })}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: c.bg,
                    cursor: 'pointer',
                    border: noteForm.color === c.id ? '2.5px solid #ffffff' : '1px solid rgba(0,0,0,0.2)',
                    boxShadow: noteForm.color === c.id ? `0 0 8px ${c.bg}` : 'none',
                    transform: noteForm.color === c.id ? 'scale(1.15)' : 'scale(1)',
                    transition: 'all 0.15s ease'
                  }}
                  title={c.label}
                />
              ))}
            </div>

            <div className="form-group">
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                Açıklama / Detaylı Notlar (Opsiyonel)
              </label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Not detayları, hatırlatma maddeleri..."
                value={noteForm.description}
                onChange={e => setNoteForm({ ...noteForm, description: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
              {editNote ? (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDeleteNote(editNote.id)}
                  style={{ fontSize: 11.5 }}
                >
                  🗑️ Notu Sil
                </button>
              ) : <div />}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setShowNoteModal(false); setEditNote(null); }}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={savingNote}
                  style={{ fontWeight: 700 }}
                >
                  {savingNote ? '⏳ Kaydediliyor...' : editNote ? 'Güncelle' : 'Kaydet'}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* ── İlgili Modüllerin Detay Pop-Up'ları (createPortal Entegre) ──── */}
      {/* 1. Servis Fişi Detay Popup */}
      {detailTicket && (
        <Modal
          isOpen={true}
          title={`Servis Fişi Detayı: ${detailTicket.ticket_no}`}
          size="xl"
          onClose={() => setDetailTicket(null)}
        >
          <ServiceTicketDetail
            ticket={detailTicket}
            onClose={() => setDetailTicket(null)}
            onUpdated={fetchCalendarData}
            currentUser={currentUser}
          />
        </Modal>
      )}

      {/* 2. Kargo Detay Modal */}
      {detailCargo && (
        <CargoDetailModal
          isOpen={true}
          cargo={detailCargo}
          onClose={() => setDetailCargo(null)}
        />
      )}

      {/* 3. Toner Detay Modal */}
      {detailToner && (
        <Modal
          isOpen={true}
          title={`🖨️ Toner Teslimat Detayı #${detailToner.id}`}
          size="md"
          onClose={() => setDetailToner(null)}
        >
          <div style={{ padding: '8px 4px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: 'var(--color-surface-alt)', padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>Toner Modeli</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text)', marginTop: 2 }}>
                  {detailToner.toner_model || '—'}
                </div>
              </div>

              <div style={{ background: 'var(--color-surface-alt)', padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>Teslim Edilen Adet</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-primary)', marginTop: 2 }}>
                  {detailToner.qty || 1} Adet
                </div>
              </div>

              <div style={{ background: 'var(--color-surface-alt)', padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>Teslim Alan Personel / Birim</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginTop: 2 }}>
                  👤 {detailToner.target_name || detailToner.assigned_user || '—'}
                </div>
              </div>

              <div style={{ background: 'var(--color-surface-alt)', padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>Teslim Tarihi</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginTop: 2 }}>
                  📅 {detailToner.change_date || '—'}
                </div>
              </div>
            </div>

            {detailToner.asset_name && (
              <div style={{ background: 'var(--color-surface-alt)', padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>İlgili Yazıcı / Cihaz</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginTop: 2 }}>
                  🖨️ {detailToner.asset_name}
                </div>
              </div>
            )}

            {detailToner.notes && (
              <div style={{ background: 'var(--color-surface-alt)', padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>Notlar</div>
                <div style={{ fontSize: 12, color: 'var(--color-text)', marginTop: 2 }}>
                  📝 {detailToner.notes}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-secondary" onClick={() => setDetailToner(null)}>
                Kapat
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
