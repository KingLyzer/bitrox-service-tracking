import React, { useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { useApp } from './context/AppContext';
import Login from './components/Login';
import PublicSharePage from './components/PublicSharePage';
import Toolbar from './components/layout/Toolbar';
import TabBar from './components/layout/TabBar';
import StatusBar from './components/layout/StatusBar';
import ServiceTicketForm from './components/modules/ServiceTickets/ServiceTicketForm';
import Modal from './components/common/Modal';
import ServiceChatPopUp from './components/common/ServiceChatPopUp';
import AnnouncementPopup from './components/common/AnnouncementPopup';
import PushPermissionPrompt from './components/common/PushPermissionPrompt';
import ThemeEffects from './components/common/ThemeEffects';
import ThemeModal from './components/common/ThemeModal';
import GuideWizard from './components/common/GuideWizard';
import OfficeRulesModal from './components/common/OfficeRules';
import ErrorBoundary from './components/common/ErrorBoundary';
import './styles/global.css';

// Modüller doğrudan içe aktarılır (Sekme geçişlerinde anında / tak diye gelmesi ve lazy-loading bekleme ekranının olmaması için)
import Dashboard from './components/modules/Dashboard';
import ServiceTickets from './components/modules/ServiceTickets';
import Toner from './components/modules/Toner';
import Stock from './components/modules/Stock';
import Reports from './components/modules/Reports';
import Maintenance from './components/modules/Maintenance';
import Inventory from './components/modules/Inventory';
import Settings from './components/modules/Settings';
import Users from './components/modules/Users';
import SystemUsers from './components/modules/SystemUsers';
import AddressLabel from './components/modules/AddressLabel';
import HandoverProtocol from './components/modules/HandoverProtocol';
import DocsAndLabels from './components/modules/DocsAndLabels';
import TasksModule from './components/modules/Tasks/TasksModule';
import FilesManager from './components/modules/FilesManager';
import Cargo from './components/modules/Cargo';
import Bitlocker from './components/modules/Bitlocker';
import Profile from './components/modules/Profile';
import User360 from './components/modules/User360';

const MODULE_MAP = {
  Dashboard, ServiceTickets, Toner, Stock, Reports, Maintenance, Inventory, Settings, Users, SystemUsers, AddressLabel, HandoverProtocol, DocsAndLabels, TasksModule, FilesManager, Cargo, Bitlocker, Profile, User360,
};

const MODULE_PERMISSIONS = {
  Dashboard: ['dashboard', 'can_view'],
  ServiceTickets: ['service', 'can_view'],
  ServiceTicketNew: ['service', 'can_create'],
  TasksModule: ['tasks', 'can_view'],
  Toner: ['toner', 'can_view'],
  Stock: ['stock', 'can_view'],
  Reports: ['reports', 'can_view'],
  Maintenance: ['maintenance', 'can_view'],
  Inventory: ['inventory', 'can_view'],
  Users: ['users', 'can_view'],
  AddressLabel: ['address_label', 'can_view'],
  HandoverProtocol: ['handover', 'can_view'],
  DocsAndLabels: ['docs_forms', 'can_view'],
  Cargo: ['cargo', 'can_view'],
  Bitlocker: ['bitlocker', 'can_view'],
  FilesManager: ['files', 'can_view'],
  Settings: ['settings', 'can_admin'],
  SystemUsers: ['settings', 'can_admin'],
};

const TOAST_ICONS = {
  success: '✓',
  danger: '✕',
  warning: '⚠️',
  info: 'ℹ',
};

function ToastContainer() {
  const { notifications, removeNotification } = useApp();
  if (!notifications || notifications.length === 0) return null;

  return (
    <div className="toast-container">
      {notifications.map(n => (
        <div
          key={n.id}
          className={`toast toast-${n.type}`}
          onClick={() => removeNotification(n.id)}
          title="Kapat"
        >
          <span style={{ fontSize: 16, flexShrink: 0 }}>{TOAST_ICONS[n.type] || 'ℹ'}</span>
          <span style={{ flex: 1 }}>{n.message}</span>
          <span style={{ opacity: 0.5, fontSize: 14, cursor: 'pointer', flexShrink: 0 }}>✕</span>
        </div>
      ))}
    </div>
  );
}

function ModuleContent({ module, tabId, tabData }) {
  const { hasPermission } = useAuth();
  const permission = MODULE_PERMISSIONS[module];

  let isAllowed = true;
  if (module === 'DocsAndLabels') {
    isAllowed = hasPermission('docs_forms', 'can_view') || hasPermission('address_label', 'can_view') || hasPermission('handover', 'can_view');
  } else if (module === 'User360') {
    isAllowed = true; // 360 profile accessible to all authenticated users
  } else if (permission) {
    isAllowed = hasPermission(permission[0], permission[1]);
  }

  if (!isAllowed) {
    return (
      <div className="flex-center flex-column" style={{ height: '100%', gap: 14 }}>
        <div style={{ fontSize: 42 }}>🔒</div>
        <div style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>Bu modüle erişim yetkiniz yok.</div>
      </div>
    );
  }

  if (module === 'ServiceTicketNew') {
    return <ServiceTicketNewWrapper tabId={tabId} />;
  }
  const Comp = MODULE_MAP[module];
  if (!Comp) return (
    <div style={{ padding: 32, color: 'var(--color-text-muted)', textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
      <div>Modül bulunamadı: {module}</div>
    </div>
  );
  return <Comp tabId={tabId} tabData={tabData} />;
}

function ServiceTicketNewWrapper({ tabId }) {
  const { closeTab, showNotification, triggerTableRefresh } = useApp();
  return (
    <Modal isOpen title="Yeni Servis Kaydı" size="xl" id={`modal-new-${tabId}`}
      onClose={() => closeTab(tabId)}
    >
      <ServiceTicketForm
        ticket={null}
        onSave={() => { closeTab(tabId); showNotification('Servis kaydı oluşturuldu.', 'success'); triggerTableRefresh(['service_tickets']); }}
        onCancel={() => closeTab(tabId)}
      />
    </Modal>
  );
}

const ALL_POSSIBLE_TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', module: 'Dashboard', closable: false },
  { id: 'user-360', label: '360° Kullanıcı Görünümü', icon: '👤', module: 'User360' },
  { id: 'service-tickets', label: 'Servis Fişleri', icon: '🔧', module: 'ServiceTickets' },
  { id: 'maintenance', label: 'Operasyon Takvimi', icon: '🗓️', module: 'Maintenance' },
  { id: 'inventory', label: 'Envanter', icon: '🖥️', module: 'Inventory' },
  { id: 'tasks', label: 'Kurulum Görevleri', icon: '📋', module: 'TasksModule' },
  { id: 'toner', label: 'Toner & Kartuş', icon: '🖨️', module: 'Toner' },
  { id: 'stock', label: 'Stok / Parça', icon: '📦', module: 'Stock' },
  { id: 'reports', label: 'Raporlar', icon: '📈', module: 'Reports' },
  { id: 'users', label: 'Personel (Snipe-IT)', icon: '🧑‍💻', module: 'Users' },
  { id: 'docs-forms', label: 'Tutanak & Etiket', icon: '✍️', module: 'DocsAndLabels' },
  { id: 'cargo', label: 'Kargo Takip', icon: '🚚', module: 'Cargo' },
  { id: 'address-label', label: 'Adres Etiketi', icon: '🏷️', module: 'DocsAndLabels' },
  { id: 'handover', label: 'Teslim Tutanağı', icon: '✍️', module: 'DocsAndLabels' },
  { id: 'files', label: 'Dosyalar', icon: '📁', module: 'FilesManager' },
  { id: 'settings', label: 'Ayarlar', icon: '⚙️', module: 'Settings' },
  { id: 'profile', label: 'Profilim', icon: '👤', module: 'Profile' },
];

export default function App() {
  const { user, hasPermission } = useAuth();
  const { tabs, activeTab, notification, setTabs, setActiveTab, resetWorkspace, themeModalOpen, closeThemeModal } = useApp();

  useEffect(() => {
    if (!user) {
      resetWorkspace();
      return;
    }

    const allowedTabs = tabs.filter(tab => {
      const permission = MODULE_PERMISSIONS[tab.module];
      return !permission || hasPermission(permission[0], permission[1]);
    });

    if (allowedTabs.length === 0) {
      const firstAllowed = ALL_POSSIBLE_TABS.find(t => {
        const p = MODULE_PERMISSIONS[t.module];
        return !p || hasPermission(p[0], p[1]);
      });
      if (firstAllowed) {
        setTabs([firstAllowed]);
        setActiveTab(firstAllowed.id);
      }
      return;
    }

    if (allowedTabs.length !== tabs.length) {
      setTabs(allowedTabs);
    }

    if (!allowedTabs.find(tab => tab.id === activeTab)) {
      setActiveTab(allowedTabs[0].id);
    }
  }, [user, hasPermission, tabs, activeTab, resetWorkspace, setActiveTab, setTabs]);

  // Check for public share link route (/share/:token or /s/:token)
  const currentPath = window.location.pathname;
  if (currentPath.startsWith('/share/') || currentPath.startsWith('/s/')) {
    const parts = currentPath.split('/');
    const token = parts[2];
    if (token) {
      return <PublicSharePage token={token} />;
    }
  }

  if (!user) return <Login />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--color-bg)' }}>
      <Toolbar />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <TabBar />
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {tabs.map(tab => (
            <div
              key={tab.id}
              style={{
                position: 'absolute', inset: 0,
                display: activeTab === tab.id ? 'flex' : 'none',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <ErrorBoundary key={tab.id}>
                <ModuleContent module={tab.module} tabId={tab.id} tabData={tab.tabData || tab.data} />
              </ErrorBoundary>
            </div>
          ))}
        </div>
      </div>
      <StatusBar notification={notification} />
      <ToastContainer />
      <ServiceChatPopUp />
      <AnnouncementPopup />
      <PushPermissionPrompt />
      <ThemeEffects />
      <ThemeModal isOpen={themeModalOpen} onClose={closeThemeModal} />
      <GuideWizard />
      <OfficeRulesModal />
    </div>
  );
}
