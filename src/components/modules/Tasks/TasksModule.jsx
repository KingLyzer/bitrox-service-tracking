import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { useApp } from '../../../context/AppContext';
import { useAuth } from '../../../context/AuthContext';
import InstallationDetailModal from './InstallationDetailModal';
import StandaloneTaskForm from './StandaloneTaskForm';
import { getApiBase, API_BASE } from '../../../utils/apiConfig';

export default function TasksModule() {
  const { user, hasPermission } = useAuth();
  const { theme, showNotification, refreshData, refreshToggle, triggerRefresh } = useApp();
  const [rowData, setRowData] = useState(() => {
    try {
      const saved = localStorage.getItem('cached_tasks_list');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [viewMode, setViewMode] = useState('pending'); // 'pending' | 'history'
  const [showTaskForm, setShowTaskForm] = useState(false);
  const gridRef = useRef();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/fisler`);
      if (res.ok) {
        const json = await res.json();
        const filteredTasks = json.filter(t => {
          const isTaskType = t.record_type === 'installation' || t.record_type === 'standalone_task';
          if (!isTaskType) return false;
          
          const isCompletedStatus = ['Tamamlandı', 'Teslim Edildi', 'İptal', 'Pert'].includes(t.status);
          
          if (viewMode === 'pending') return !isCompletedStatus;
          if (viewMode === 'history') return isCompletedStatus;
          return false;
        });
        setRowData(filteredTasks);
        try { localStorage.setItem('cached_tasks_list', JSON.stringify(filteredTasks)); } catch {}
      }
    } catch (e) {
      console.warn('Görevler yüklenemedi', e);
      showNotification('Görevler yüklenemedi.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshData?.service_tickets, refreshToggle, viewMode]);

  const columnDefs = useMemo(() => [
    { field: 'ticket_no', headerName: 'Fiş No / Kod', width: 110, pinned: 'left' },
    { field: 'created_at', headerName: 'Oluşturulma', width: 118, valueFormatter: p => p.value ? new Date(p.value).toLocaleString('tr-TR').slice(0, 16) : '' },
    { field: 'model_name', headerName: 'Görev / Cihaz', flex: 1, minWidth: 160 },
    { field: 'user_name', headerName: 'Atanan / Kullanıcı', width: 150 },
    { field: 'record_type', headerName: 'Tip', width: 110, valueFormatter: p => p.value === 'standalone_task' ? 'Görev' : 'Kurulum' },
    { field: 'status', headerName: 'Durum', width: 130, cellClassRules: {
        'legacy-cell-blue': () => true
      }
    },
  ], []);

  const onRowDoubleClicked = (e) => {
    if (e.data) {
      setSelectedTicket(e.data);
    }
  };

  return (
    <div className="legacy-erp">
      <div className="legacy-workspace">
        <div className="legacy-titlebar">
          <span>{viewMode === 'pending' ? 'Bekleyen Görevler' : 'Görev Geçmişi'}</span>
          <span>{`Toplam: ${rowData.length}`}</span>
        </div>

        <div className="legacy-ribbon" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 5, marginBottom: 10 }}>
          <div className="legacy-ribbon-group">
            <button className={`legacy-ribbon-button ${viewMode === 'pending' ? 'active' : ''}`} onClick={() => setViewMode('pending')} style={{ background: viewMode === 'pending' ? 'var(--color-surface)' : 'transparent', fontWeight: viewMode === 'pending' ? 'bold' : 'normal' }}>
              <span className="legacy-ribbon-icon">⏳</span>Bekleyenler
            </button>
            <button className={`legacy-ribbon-button ${viewMode === 'history' ? 'active' : ''}`} onClick={() => setViewMode('history')} style={{ background: viewMode === 'history' ? 'var(--color-surface)' : 'transparent', fontWeight: viewMode === 'history' ? 'bold' : 'normal' }}>
              <span className="legacy-ribbon-icon">📜</span>Geçmiş
            </button>
          </div>
          <div className="legacy-ribbon-group">
            {hasPermission('tasks', 'can_create') && (
              <button className="legacy-ribbon-button" onClick={() => setShowTaskForm(true)}>
                <span className="legacy-ribbon-icon">➕</span>Görev Ekle
              </button>
            )}
            <button className="legacy-ribbon-button" onClick={loadData}>
              <span className="legacy-ribbon-icon">🔄</span>Yenile
            </button>
          </div>
        </div>

        <div className="legacy-grid-wrap" style={{ flex: 1, height: '100%' }}>
          <div className={theme === 'light' || theme === 'sakura' ? 'ag-theme-quartz' : 'ag-theme-quartz-dark'} style={{ height: '100%', width: '100%' }}>
            <AgGridReact
              ref={gridRef}
              theme="legacy"
              rowData={rowData}
              columnDefs={columnDefs}
              rowSelection={{ mode: 'singleRow' }}
              onRowDoubleClicked={onRowDoubleClicked}
              enableCellTextSelection={true}
              rowHeight={22}
              headerHeight={24}
              suppressDragLeaveHidesColumns={true}
              overlayNoRowsTemplate={'<span class="ag-overlay-no-rows-center">Görev bulunmuyor.</span>'}
            />
          </div>
        </div>
      </div>

      {selectedTicket && (selectedTicket.record_type === 'installation' || selectedTicket.record_type === 'standalone_task') && (
        <InstallationDetailModal 
          ticket={selectedTicket} 
          onClose={() => setSelectedTicket(null)} 
          onComplete={() => {
            setSelectedTicket(null);
            triggerRefresh();
            loadData();
          }}
        />
      )}

      {showTaskForm && (
        <StandaloneTaskForm 
          onClose={() => setShowTaskForm(false)}
          onSave={() => {
            setShowTaskForm(false);
            triggerRefresh();
            loadData();
          }}
        />
      )}
    </div>
  );
}
