import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useApp } from '../../../context/AppContext';
import { MODULE_GUIDES } from './guideData';
import GuideWizardModal from './GuideWizardModal';

export default function GuideWizard() {
  const { user } = useAuth();
  const { tabs, activeTab, showNotification } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [activeGuideModule, setActiveGuideModule] = useState('Dashboard');
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // Aktif sekmenin hangi modüle ait olduğunu tespit et
  const currentTabObj = tabs.find(t => t.id === activeTab);
  const currentModule = currentTabObj?.module || 'Dashboard';

  const userId = user?.id || user?.username || 'default_user';

  // Belirli bir modülün daha önce görülüp görülmediğini kontrol et
  const getSeenKey = useCallback((mod) => `st_guide_seen_${userId}_${mod}`, [userId]);

  // Kullanıcının tüm sihirbazları kalıcı olarak kapatıp kapatmadığını kontrol et
  const isAllDisabled = Boolean(
    user?.guide_disabled === 1 ||
    user?.guide_disabled === true ||
    localStorage.getItem(`st_guide_all_disabled_${userId}`) === 'true' ||
    localStorage.getItem('st_guide_all_disabled_global') === 'true'
  );

  // Sekme değiştiğinde ilk kez giriş yapılıp yapılmadığını kontrol et ve gerekirse otomatik aç
  useEffect(() => {
    if (!currentModule || !MODULE_GUIDES[currentModule]) return;

    // Eğer tüm sihirbazlar kapatılmışsa otomatik açma!
    if (isAllDisabled) {
      return;
    }

    setActiveGuideModule(currentModule);

    const isSeen = localStorage.getItem(getSeenKey(currentModule)) === 'true';
    setDontShowAgain(isSeen);

    if (!isSeen) {
      // Sayfa render olduktan 450ms sonra yumuşak bir şekilde sihirbazı aç
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [currentModule, getSeenKey, isAllDisabled]);

  // Global event listener: Dışarıdan (örn Toolbar veya butonlardan) sihirbazı açmak için
  useEffect(() => {
    const handleOpenEvent = (e) => {
      const targetMod = e.detail?.module || currentModule;
      if (MODULE_GUIDES[targetMod]) {
        setActiveGuideModule(targetMod);
      }
      setIsOpen(true);
    };

    window.addEventListener('service_tracker_open_guide', handleOpenEvent);
    window.openModuleGuide = (mod) => {
      window.dispatchEvent(new CustomEvent('service_tracker_open_guide', { detail: { module: mod } }));
    };

    return () => {
      window.removeEventListener('service_tracker_open_guide', handleOpenEvent);
      delete window.openModuleGuide;
    };
  }, [currentModule]);

  const handleClose = () => {
    setIsOpen(false);
    // Kapatıldığında bu bölümü otomatik görüldü olarak işaretle
    localStorage.setItem(getSeenKey(activeGuideModule), 'true');
    setDontShowAgain(true);
  };

  const handleToggleDontShowAgain = () => {
    const nextVal = !dontShowAgain;
    setDontShowAgain(nextVal);
    if (nextVal) {
      localStorage.setItem(getSeenKey(activeGuideModule), 'true');
    } else {
      localStorage.removeItem(getSeenKey(activeGuideModule));
    }
  };

  // Tek tıkla tüm modüllerin sihirbazlarını kalıcı olarak kapat
  const handleDisableAllGuides = async () => {
    setIsOpen(false);

    // 1. LocalStorage kalıcı kaydı (anlık etki)
    try {
      localStorage.setItem(`st_guide_all_disabled_${userId}`, 'true');
      localStorage.setItem('st_guide_all_disabled_global', 'true');
      Object.keys(MODULE_GUIDES).forEach(mod => {
        localStorage.setItem(getSeenKey(mod), 'true');
      });
    } catch (e) {}

    // 2. Kullanıcı nesnesi durumunu güncelle
    if (user) {
      user.guide_disabled = 1;
    }

    // 3. Sunucu / Veritabanı kalıcı kaydı (Çerezler silinse dahi veritabanından hatırlanacak)
    try {
      if (window.electronAPI?.setGuideDisabled) {
        await window.electronAPI.setGuideDisabled(1, user?.id, user?.username);
      } else if (window.electronAPI?.run) {
        await window.electronAPI.run(
          'UPDATE users SET guide_disabled = 1 WHERE id = ? OR username = ?',
          [user?.id || 0, user?.username || '']
        );
      }
    } catch (err) {
      console.warn('[GuideWizard] Tercih kaydedilemedi:', err);
    }

    showNotification?.(
      'Tüm kullanım sihirbazları kapatıldı. İhtiyacınız olduğunda üst menüdeki "Sihirbaz" butonundan dilediğiniz zaman tekrar açabilirsiniz.',
      'info'
    );
  };

  const activeGuide = MODULE_GUIDES[activeGuideModule] || MODULE_GUIDES[currentModule] || MODULE_GUIDES.Dashboard;

  return (
    <GuideWizardModal
      guide={activeGuide}
      isOpen={isOpen}
      onClose={handleClose}
      dontShowAgain={dontShowAgain}
      onToggleDontShowAgain={handleToggleDontShowAgain}
      onDisableAllGuides={handleDisableAllGuides}
      onSelectModuleGuide={(modKey) => {
        if (MODULE_GUIDES[modKey]) {
          setActiveGuideModule(modKey);
        }
      }}
    />
  );
}
