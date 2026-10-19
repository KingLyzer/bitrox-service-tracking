import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../../../context/AuthContext';
import { useApp } from '../../../context/AppContext';
import ConfirmDialog from '../../common/ConfirmDialog';
import PromptDialog from '../../common/PromptDialog';
import Modal from '../../common/Modal';
import './style.css';
import { getApiBase, API_BASE } from '../../../utils/apiConfig';

function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function FilesManager() {
  const { user, hasPermission } = useAuth();
  const { showNotification } = useApp();
  
  // Upload progress state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadProgressBytes, setUploadProgressBytes] = useState('');
  
  // State
  const [dbFiles, setDbFiles] = useState(() => {
    try {
      const saved = localStorage.getItem('cached_user_files');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [storageFiles, setStorageFiles] = useState(() => {
    try {
      const saved = localStorage.getItem('cached_storage_files');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  
  // Navigation History
  const [history, setHistory] = useState([null]); // null = Kök Dizin
  const [historyIndex, setHistoryIndex] = useState(0);
  const currentFolderId = history[historyIndex];

  // Storage State
  const [storageSubPath, setStorageSubPath] = useState('');
  const [storageBasePath, setStorageBasePath] = useState('\\\\172.16.1.97\\Storage');
  const [storageHistory, setStorageHistory] = useState(['']);
  const [storageHistoryIndex, setStorageHistoryIndex] = useState(0);

  // Clipboard State (Cut / Copy / Paste)
  const [clipboard, setClipboard] = useState(null);

  // Filters
  const [sidebarFilter, setSidebarFilter] = useState('all'); // 'all', 'mine', 'shared', 'storage'
  const [searchQuery, setSearchQuery] = useState('');
  
  const [users, setUsers] = useState([]);
  
  // Modals
  const [confirmAction, setConfirmAction] = useState(null);
  const [promptAction, setPromptAction] = useState(null);
  const [noteModal, setNoteModal] = useState(null); 
  const [editorTab, setEditorTab] = useState('preview'); // 'edit' | 'preview' 
  const [shareModal, setShareModal] = useState(null); 
  const [contextMenu, setContextMenu] = useState(null);
  const [emptyContextMenu, setEmptyContextMenu] = useState(null);
  const [showToolbarMenu, setShowToolbarMenu] = useState(false);
  
  // Inline rename state
  const [editingFileId, setEditingFileId] = useState(null);
  const [editingFileName, setEditingFileName] = useState('');

  // Selection state (multi-select with Ctrl and range-select with Shift)
  const [selectedFileIds, setSelectedFileIds] = useState([]);
  const [lastSelectedId, setLastSelectedId] = useState(null);
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fileInputRef = useRef(null);

  const loadFiles = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/api/files?user_id=${user.id}`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data || [];
        setDbFiles(data);
        try { localStorage.setItem('cached_user_files', JSON.stringify(data)); } catch {}
      }
    } catch (e) {
      showNotification('Dosyalar yüklenirken hata oluştu.', 'danger');
    } finally {
      setLoading(false);
    }
  }, [user, showNotification]);

  const loadStorageFiles = useCallback(async (subpath = storageSubPath, silent = false) => {
    if (!user) return;
    if (!silent && storageFiles.length === 0) setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/files/storage/list?subpath=${encodeURIComponent(subpath)}`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data || [];
        setStorageFiles(data);
        if (!subpath) {
          try { localStorage.setItem('cached_storage_files', JSON.stringify(data)); } catch {}
        }
        if (json.basePath) setStorageBasePath(json.basePath);
      }
    } catch (e) {
      if (!silent) showNotification('Ağ deposu yüklenirken hata oluştu.', 'danger');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user, storageSubPath, showNotification, storageFiles.length]);

  const loadUsers = useCallback(async () => {
    try {
      const res = await window.electronAPI.getUsers(false);
      if (res && res.success) {
        setUsers(res.data || []);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (sidebarFilter === 'storage') {
      loadStorageFiles(storageSubPath);
    } else {
      loadFiles();
    }
    loadUsers();
    
    const handleRefresh = () => {
      if (sidebarFilter === 'storage') loadStorageFiles(storageSubPath, true);
      else loadFiles();
    };
    window.addEventListener('files-updated', handleRefresh);
    return () => window.removeEventListener('files-updated', handleRefresh);
  }, [sidebarFilter, storageSubPath, loadFiles, loadStorageFiles, loadUsers]);

  // Background auto-refresh when viewing Network Storage (polls every 3.5s silently)
  useEffect(() => {
    if (sidebarFilter === 'storage') {
      const interval = setInterval(() => {
        loadStorageFiles(storageSubPath, true);
      }, 3500);
      return () => clearInterval(interval);
    }
  }, [sidebarFilter, storageSubPath, loadStorageFiles]);

  // Handle global click to close context menu
  useEffect(() => {
    const handleClick = () => {
      setContextMenu(null);
      setEmptyContextMenu(null);
      setShowToolbarMenu(false);
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // Navigation Logic
  const pushStorageHistory = (newSub) => {
    const newHist = storageHistory.slice(0, storageHistoryIndex + 1);
    newHist.push(newSub);
    setStorageHistory(newHist);
    setStorageHistoryIndex(newHist.length - 1);
    setStorageSubPath(newSub);
    setSearchQuery('');
  };

  const navigateTo = (folderId) => {
    if (folderId === currentFolderId) return;
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(folderId);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setSearchQuery('');
  };

  const goBack = () => {
    if (sidebarFilter === 'storage') {
      if (storageHistoryIndex > 0) {
        const nextIdx = storageHistoryIndex - 1;
        setStorageHistoryIndex(nextIdx);
        setStorageSubPath(storageHistory[nextIdx]);
        setSearchQuery('');
      }
      return;
    }
    if (historyIndex > 0) {
      setHistoryIndex(i => i - 1);
      setSearchQuery('');
    }
  };

  const goForward = () => {
    if (sidebarFilter === 'storage') {
      if (storageHistoryIndex < storageHistory.length - 1) {
        const nextIdx = storageHistoryIndex + 1;
        setStorageHistoryIndex(nextIdx);
        setStorageSubPath(storageHistory[nextIdx]);
        setSearchQuery('');
      }
      return;
    }
    if (historyIndex < history.length - 1) {
      setHistoryIndex(i => i + 1);
      setSearchQuery('');
    }
  };

  const goUp = () => {
    if (sidebarFilter === 'storage') {
      if (!storageSubPath) return;
      const parts = storageSubPath.replace(/[/\\]+$/, '').split(/[/\\]/);
      parts.pop();
      const parentSub = parts.join('/');
      pushStorageHistory(parentSub);
      return;
    }
    if (currentFolderId === null) return;
    const current = dbFiles.find(f => f.id === currentFolderId);
    if (current) navigateTo(current.parent_id);
    else navigateTo(null);
  };

  const getBreadcrumbs = () => {
    const crumbs = [];
    let current = dbFiles.find(f => f.id === currentFolderId);
    while (current) {
      crumbs.unshift(current);
      current = dbFiles.find(f => f.id === current.parent_id);
    }
    return crumbs;
  };

  // Filtering
  const activeMenu = sidebarFilter;
  const targetArray = activeMenu === 'storage' ? storageFiles : dbFiles;
  const filteredFiles = targetArray.filter(f => {
    let match = false;
    if (activeMenu === 'storage') match = true;
    else if (activeMenu === 'all') match = f.parent_id === currentFolderId;
    else if (activeMenu === 'mine') match = f.user_id === user.id;
    else if (activeMenu === 'shared') match = f.user_id !== user.id;
    
    if (match && searchQuery) {
      match = f.name.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return match;
  });

  const handleSort = (col) => {
    if (sortColumn === col) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  };

  const getIcon = (type) => {
    if (type === 'folder') return '📁';
    if (type === 'note') return '📝';
    return '📄';
  };
  
  const getExt = (item) => {
    if (item.type === 'folder') return 'Klasör';
    if (item.type === 'note') return 'Not';
    if (!item.name) return 'Dosya';
    const split = item.name.split('.');
    return split.length > 1 ? `.${split.pop().toUpperCase()}` : 'Dosya';
  };

  const sortedFiles = [...filteredFiles].sort((a, b) => {
    // 1. Folders ALWAYS come first (Windows Explorer behavior)
    const isFolderA = a.type === 'folder' ? 1 : 0;
    const isFolderB = b.type === 'folder' ? 1 : 0;
    
    if (isFolderA !== isFolderB) {
      return isFolderB - isFolderA;
    }

    // 2. Sort within the folder / file group
    let valA, valB;
    
    switch (sortColumn) {
      case 'type':
        valA = getExt(a).toLowerCase();
        valB = getExt(b).toLowerCase();
        break;
      case 'size':
        valA = a.size || 0;
        valB = b.size || 0;
        break;
      case 'owner':
        valA = (a.owner_name || '').toLowerCase();
        valB = (b.owner_name || '').toLowerCase();
        break;
      case 'date':
        valA = new Date(a.updated_at || a.created_at || 0).getTime();
        valB = new Date(b.updated_at || b.created_at || 0).getTime();
        break;
      case 'name':
      default:
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
        break;
    }
    
    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return a.name.localeCompare(b.name, 'tr', { sensitivity: 'base' });
  });

  const currentFiles = sortedFiles;

  // --- ACTIONS ---

  const handleCopy = (itemOrItems) => {
    const items = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems];
    if (items.length === 0) return;
    setClipboard({
      action: 'copy',
      mode: sidebarFilter === 'storage' ? 'storage' : 'db',
      items
    });
    showNotification(`${items.length} öğe kopyalandı.`, 'info');
  };

  const handleCut = (itemOrItems) => {
    const items = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems];
    if (items.length === 0) return;
    setClipboard({
      action: 'cut',
      mode: sidebarFilter === 'storage' ? 'storage' : 'db',
      items
    });
    showNotification(`${items.length} öğe kesildi.`, 'info');
  };

  const handlePaste = useCallback(async () => {
    if (!clipboard || !clipboard.items || clipboard.items.length === 0) return;
    setLoading(true);
    try {
      const targetMode = sidebarFilter === 'storage' ? 'storage' : 'db';
      const res = await fetch(`${API_BASE}/api/files/storage/paste`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: clipboard.action,
          source_mode: clipboard.mode,
          target_mode: targetMode,
          source_items: clipboard.items,
          target_folder_id: currentFolderId,
          target_subpath: storageSubPath,
          user_id: user.id
        })
      });
      const json = await res.json();
      if (json.success) {
        showNotification(`${clipboard.items.length} öğe ${clipboard.action === 'cut' ? 'taşındı' : 'kopyalandı'}.`, 'success');
        if (clipboard.action === 'cut') setClipboard(null);
        if (targetMode === 'storage') loadStorageFiles(storageSubPath);
        else loadFiles();
      } else {
        showNotification(json.message || 'Yapıştırma hatası', 'danger');
      }
    } catch (e) {
      showNotification('Yapıştırma işlemi sırasında hata oluştu', 'danger');
    } finally {
      setLoading(false);
    }
  }, [clipboard, sidebarFilter, currentFolderId, storageSubPath, user, loadFiles, loadStorageFiles, showNotification]);

  // Keyboard Shortcuts: Ctrl+A, Ctrl+C, Ctrl+X, Ctrl+V
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelectedFileIds(currentFiles.map(f => f.id));
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (selectedFileIds.length > 0) {
          const items = currentFiles.filter(f => selectedFileIds.includes(f.id));
          if (items.length > 0) {
            e.preventDefault();
            handleCopy(items);
          }
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
        if (selectedFileIds.length > 0) {
          const items = currentFiles.filter(f => selectedFileIds.includes(f.id));
          if (items.length > 0) {
            e.preventDefault();
            handleCut(items);
          }
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (clipboard && clipboard.items && clipboard.items.length > 0) {
          e.preventDefault();
          handlePaste();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFileIds, currentFiles, clipboard, handlePaste]);

  const handleCreateFolder = () => {
    setPromptAction({
      title: 'Yeni Klasör',
      message: 'Klasör adını girin:',
      defaultValue: 'Yeni Klasör',
      onConfirm: async (name) => {
        setPromptAction(null);
        if (!name?.trim()) return;
        try {
          if (sidebarFilter === 'storage') {
            const res = await fetch(`${API_BASE}/api/files/storage/folder`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: name.trim(), subpath: storageSubPath })
            });
            if (res.ok) {
              showNotification('Klasör oluşturuldu (Ağ Deposu)', 'success');
              loadStorageFiles(storageSubPath);
            }
          } else {
            const res = await fetch(`${API_BASE}/api/files/item`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user_id: user.id, parent_id: currentFolderId, type: 'folder', name: name.trim() })
            });
            if (res.ok) { showNotification('Klasör oluşturuldu', 'success'); loadFiles(); }
          }
        } catch (e) { showNotification('Hata oluştu', 'danger'); }
      }
    });
  };

  const handleCreateNote = () => {
    setNoteModal({ mode: 'add', id: null, name: 'Yeni Not', content: '', originalContent: '' });
    setEditorTab('edit');
  };

  const handleSaveNote = async () => {
    if (!noteModal.name?.trim()) return showNotification('Not başlığı girin', 'warning');
    try {
      if (noteModal.mode === 'add') {
        const res = await fetch(`${API_BASE}/api/files/item`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id, parent_id: currentFolderId, type: 'note', name: noteModal.name, content: noteModal.content })
        });
        if (res.ok) { showNotification('Not kaydedildi', 'success'); loadFiles(); }
      } else {
        const res = await fetch(`${API_BASE}/api/files/item/${noteModal.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: noteModal.name, content: noteModal.content })
        });
        if (res.ok) { showNotification('Not güncellendi', 'success'); loadFiles(); }
      }
      setNoteModal(null);
    } catch (e) { showNotification('Hata oluştu', 'danger'); }
  };

  const handleCloseNote = () => {
    if (noteModal.content !== noteModal.originalContent) {
      setConfirmAction({
        title: 'Kaydetmeden Çık',
        message: 'Değişiklikleriniz var. Kaydetmeden çıkmak istediğinize emin misiniz?',
        type: 'warning',
        onConfirm: () => {
          setConfirmAction(null);
          setNoteModal(null);
        }
      });
    } else {
      setNoteModal(null);
    }
  };

  const insertAtCursor = (beforeVal, afterVal = '') => {
    const textarea = document.getElementById('note-textarea');
    if (!textarea) return;

    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const text = noteModal.content || '';
    const selectedText = text.substring(startPos, endPos);
    
    const replacement = beforeVal + (selectedText || '') + afterVal;
    const newContent = text.substring(0, startPos) + replacement + text.substring(endPos);
    
    setNoteModal({ ...noteModal, content: newContent });
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        startPos + beforeVal.length,
        startPos + beforeVal.length + selectedText.length
      );
    }, 0);
  };

  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleBatchUpload(e.dataTransfer.files);
    }
  };

  const handleBatchUpload = async (fileList) => {
    const rawFiles = Array.from(fileList || []);
    if (rawFiles.length === 0) return;

    setUploading(true);
    const totalFiles = rawFiles.length;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < totalFiles; i++) {
      const file = rawFiles[i];
      setUploadFileName(`[${i + 1}/${totalFiles}] ${file.name}`);
      setUploadProgress(0);
      setUploadProgressBytes(`0 B / ${formatBytes(file.size)}`);

      if (sidebarFilter === 'storage') {
        const formData = new FormData();
        formData.append('file', file);
        try {
          const res = await axios.post(`${API_BASE}/api/files/storage/upload?subpath=${encodeURIComponent(storageSubPath)}`, formData, {
            onUploadProgress: (progressEvent) => {
              const loaded = progressEvent.loaded;
              const total = progressEvent.total || file.size;
              const percent = Math.round((loaded * 100) / total);
              setUploadProgress(percent);
              setUploadProgressBytes(`${formatBytes(loaded)} / ${formatBytes(total)}`);
            }
          });
          if (res.data?.success || res.status === 200) successCount++;
          else failCount++;
        } catch (err) { failCount++; }
      } else {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('user_id', user.id);
        if (currentFolderId) formData.append('parent_id', currentFolderId);

        try {
          const res = await axios.post(`${API_BASE}/api/files/upload`, formData, {
            onUploadProgress: (progressEvent) => {
              const loaded = progressEvent.loaded;
              const total = progressEvent.total || file.size;
              const percent = Math.round((loaded * 100) / total);
              setUploadProgress(percent);
              setUploadProgressBytes(`${formatBytes(loaded)} / ${formatBytes(total)}`);
            }
          });
          if (res.data?.success || res.status === 200) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (err) {
          console.error('[Upload error]', err);
          failCount++;
        }
      }
    }

    setUploading(false);
    setUploadProgress(0);
    setUploadFileName('');
    setUploadProgressBytes('');

    if (successCount > 0) {
      showNotification(`${successCount} adet dosya yüklendi.${failCount > 0 ? ` (${failCount} hata)` : ''}`, 'success');
      if (sidebarFilter === 'storage') loadStorageFiles(storageSubPath);
      else loadFiles();
    } else {
      showNotification('Dosya yükleme başarısız', 'danger');
    }
  };

  const handleFileUpload = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    handleBatchUpload(files);
    e.target.value = null; 
  };

  const handleDelete = (itemOrItems) => {
    const items = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems];
    if (items.length === 0) return;

    setConfirmAction({
      title: 'Silmeyi Onayla',
      message: items.length === 1 ? `"${items[0].name}" öğesini silmek istediğinize emin misiniz?` : `${items.length} adet öğeyi silmek istediğinize emin misiniz?`,
      type: 'danger',
      onConfirm: async () => {
        setConfirmAction(null);
        try {
          for (const item of items) {
            if (item.is_storage) {
              await fetch(`${API_BASE}/api/files/storage/item`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item_path: item.id })
              });
            } else {
              await fetch(`${API_BASE}/api/files/item/${item.id}`, { method: 'DELETE' });
            }
          }
          showNotification(`${items.length} öğe silindi.`, 'success');
          setSelectedFileIds([]);
          if (sidebarFilter === 'storage') loadStorageFiles(storageSubPath);
          else loadFiles();
        } catch (e) { showNotification('Hata', 'danger'); }
      }
    });
  };

  const handleRename = (item) => {
    setEditingFileId(item.id);
    setEditingFileName(item.name);
  };

  const handleSaveRename = async (item) => {
    const newName = editingFileName.trim();
    if (!newName || newName === item.name) {
      setEditingFileId(null);
      return;
    }
    try {
      if (item.is_storage) {
        const res = await fetch(`${API_BASE}/api/files/storage/item`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_path: item.id, new_name: newName })
        });
        if (res.ok) {
          showNotification('Ad değiştirildi', 'success');
          loadStorageFiles(storageSubPath);
        } else {
          showNotification('Yeniden adlandırma başarısız', 'danger');
        }
      } else {
        const res = await fetch(`${API_BASE}/api/files/item/${item.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName, content: item.content })
        });
        if (res.ok) { 
          showNotification('Ad değiştirildi', 'success'); 
          loadFiles(); 
        }
      }
    } catch (e) { 
      showNotification('Hata', 'danger'); 
    }
    setEditingFileId(null);
  };

  const openShareModal = async (item) => {
    try {
      let internalShares = [];
      if (!item.is_storage) {
        const res = await fetch(`${API_BASE}/api/files/share/${item.id}`);
        const json = await res.json();
        internalShares = json.data || [];
      }

      // Fetch existing public share
      const pubQuery = item.is_storage 
        ? `source_mode=storage&storage_path=${encodeURIComponent(item.id)}`
        : `source_mode=db&file_id=${item.id}`;
      const pubRes = await fetch(`${API_BASE}/api/files/storage/public-shares?${pubQuery}`);
      const pubJson = await pubRes.json();
      const existingPublic = pubJson.success && pubJson.data && pubJson.data.length > 0 ? pubJson.data[0] : null;

      setShareModal({
        ...item,
        shared_with: internalShares,
        activeTab: item.is_storage ? 'public' : 'internal',
        publicShare: existingPublic,
        expires_in_hours: '168',
        has_password: false,
        password: '',
        download_limit: '',
        copied: false,
        savingPublic: false
      });
    } catch (e) {
      showNotification('Paylaşım bilgileri alınamadı', 'danger');
    }
  };

  const handleSaveShare = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/files/share/${shareModal.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shared_by: user.id, user_ids: shareModal.shared_with })
      });
      if (res.ok) {
        showNotification('Paylaşımlar güncellendi', 'success');
        if (shareModal?.is_storage) {
          loadStorageFiles(storageSubPath);
        } else {
          loadFiles();
        }
      }
      setShareModal(null);
    } catch (e) { showNotification('Hata oluştu', 'danger'); }
  };

  const handleCreatePublicShare = async () => {
    if (shareModal.has_password && !shareModal.password.trim()) {
      showNotification('Lütfen bir paylaşım şifresi belirleyin veya şifre korumasını kapatın.', 'warning');
      return;
    }
    setShareModal(s => ({ ...s, savingPublic: true }));
    try {
      const payload = {
        source_mode: shareModal.is_storage ? 'storage' : 'db',
        file_id: shareModal.is_storage ? null : shareModal.id,
        storage_path: shareModal.is_storage ? shareModal.id : null,
        name: shareModal.name,
        type: shareModal.type,
        size: shareModal.size || 0,
        created_by: user.id,
        password: shareModal.has_password ? shareModal.password.trim() : null,
        expires_in_hours: shareModal.expires_in_hours === 'never' ? null : Number(shareModal.expires_in_hours),
        download_limit: shareModal.download_limit ? Number(shareModal.download_limit) : null
      };

      const res = await fetch(`${API_BASE}/api/files/storage/public-shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showNotification('Herkese açık paylaşım bağlantısı oluşturuldu!', 'success');
        setShareModal(s => ({
          ...s,
          publicShare: json.data,
          savingPublic: false
        }));
        if (shareModal.is_storage) {
          loadStorageFiles(storageSubPath);
        } else {
          loadFiles();
        }
      } else {
        showNotification(json.message || 'Bağlantı oluşturulamadı', 'danger');
        setShareModal(s => ({ ...s, savingPublic: false }));
      }
    } catch (e) {
      showNotification('Hata oluştu', 'danger');
      setShareModal(s => ({ ...s, savingPublic: false }));
    }
  };

  const handleRevokePublicShare = async (shareId) => {
    try {
      const res = await fetch(`${API_BASE}/api/files/storage/public-shares/${shareId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showNotification('Paylaşım bağlantısı iptal edildi', 'success');
        setShareModal(s => ({
          ...s,
          publicShare: null,
          copied: false
        }));
        if (shareModal?.is_storage) {
          loadStorageFiles(storageSubPath);
        } else {
          loadFiles();
        }
      }
    } catch (e) {
      showNotification('Hata oluştu', 'danger');
    }
  };

  const handleCopyPublicLink = (token) => {
    const url = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(url);
    setShareModal(s => ({ ...s, copied: true }));
    showNotification('Paylaşım bağlantısı panoya kopyalandı! 📋', 'success');
    setTimeout(() => {
      setShareModal(s => s ? { ...s, copied: false } : null);
    }, 3000);
  };

  const handleItemDoubleclick = (item) => {
    if (item.is_storage) {
      if (item.type === 'folder') {
        pushStorageHistory(item.id);
      } else {
        window.open(`${API_BASE}/api/files/storage/download?item_path=${encodeURIComponent(item.id)}`, '_blank');
      }
      return;
    }
    if (item.type === 'folder') {
      sidebarFilter !== 'all' ? setSidebarFilter('all') : null;
      navigateTo(item.id);
    } else if (item.type === 'note') {
      setNoteModal({ mode: 'edit', id: item.id, name: item.name, content: item.content, originalContent: item.content });
      setEditorTab('preview');
    } else if (item.type === 'file') {
      window.open(`${API_BASE}/files/${encodeURIComponent(item.file_path)}`, '_blank');
    }
  };

  const handleItemClick = (e, item) => {
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      if (selectedFileIds.includes(item.id)) {
        setSelectedFileIds(selectedFileIds.filter(id => id !== item.id));
      } else {
        setSelectedFileIds([...selectedFileIds, item.id]);
        setLastSelectedId(item.id);
      }
    } else if (e.shiftKey && lastSelectedId) {
      const idx1 = currentFiles.findIndex(f => f.id === lastSelectedId);
      const idx2 = currentFiles.findIndex(f => f.id === item.id);
      if (idx1 !== -1 && idx2 !== -1) {
        const start = Math.min(idx1, idx2);
        const end = Math.max(idx1, idx2);
        const rangeIds = currentFiles.slice(start, end + 1).map(f => f.id);
        setSelectedFileIds(Array.from(new Set([...selectedFileIds, ...rangeIds])));
      } else {
        setSelectedFileIds([item.id]);
        setLastSelectedId(item.id);
      }
    } else {
      setSelectedFileIds([item.id]);
      setLastSelectedId(item.id);
    }
  };

  const handleContextMenu = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    let currentSel = selectedFileIds;
    if (!selectedFileIds.includes(item.id)) {
      currentSel = [item.id];
      setSelectedFileIds([item.id]);
      setLastSelectedId(item.id);
    }
    const selectedItems = currentFiles.filter(f => currentSel.includes(f.id));
    setContextMenu({
      item,
      items: selectedItems,
      x: e.pageX,
      y: e.pageY
    });
  };

  const handleEmptyContextMenu = (e) => {
    e.preventDefault();
    setSelectedFileIds([]);
    setEmptyContextMenu({
      x: e.pageX,
      y: e.pageY
    });
  };

  return (
    <div className="peazip-container">
      {/* 2. ADDRESS / NAVIGATION BAR */}
      <div className="pz-address-bar-wrapper">
        <div className="pz-nav-buttons">
          <button 
            className="pz-nav-btn" 
            onClick={goBack} 
            disabled={sidebarFilter === 'storage' ? storageHistoryIndex === 0 : historyIndex === 0} 
            title="Geri"
          >
            ←
          </button>
          <button 
            className="pz-nav-btn" 
            onClick={goForward} 
            disabled={sidebarFilter === 'storage' ? storageHistoryIndex === storageHistory.length - 1 : historyIndex === history.length - 1} 
            title="İleri"
          >
            →
          </button>
          <button 
            className="pz-nav-btn" 
            onClick={goUp} 
            disabled={sidebarFilter === 'storage' ? !storageSubPath : currentFolderId === null} 
            title="Üst Dizin"
          >
            ↑
          </button>
        </div>
        
        <div className="pz-address-bar">
          {sidebarFilter === 'storage' ? (
            <>
              <span className="pz-address-crumb" onClick={() => pushStorageHistory('')}>
                🌐 Ağ Deposu (Storage)
              </span>
              {storageSubPath.split(/[/\\]/).filter(Boolean).map((part, idx, arr) => {
                const crumbPath = arr.slice(0, idx + 1).join('/');
                return (
                  <React.Fragment key={crumbPath}>
                    <span className="pz-address-sep">›</span>
                    <span className="pz-address-crumb" onClick={() => pushStorageHistory(crumbPath)}>{part}</span>
                  </React.Fragment>
                );
              })}
            </>
          ) : (
            <>
              <span className="pz-address-crumb" onClick={() => { setSidebarFilter('all'); navigateTo(null); }}>
                💻 Kök Dizin
              </span>
              {sidebarFilter === 'all' && getBreadcrumbs().map(b => (
                <React.Fragment key={b.id}>
                  <span className="pz-address-sep">›</span>
                  <span className="pz-address-crumb" onClick={() => navigateTo(b.id)}>{b.name}</span>
                </React.Fragment>
              ))}
              {sidebarFilter === 'mine' && <><span className="pz-address-sep">›</span><span className="pz-address-crumb">Benim Dosyalarım</span></>}
              {sidebarFilter === 'shared' && <><span className="pz-address-sep">›</span><span className="pz-address-crumb">Benimle Paylaşılanlar</span></>}
            </>
          )}
        </div>

        <div className="pz-search-box">
          <span className="pz-search-icon">🔍</span>
          <input 
            type="text" 
            placeholder="Arama..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ position: 'relative' }}>
          <button className="pz-tool-dropdown-btn" onClick={(e) => { e.stopPropagation(); setShowToolbarMenu(!showToolbarMenu); }}>
            İşlemler <span>▼</span>
          </button>
          {showToolbarMenu && (
            <div className="pz-context-menu" style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4 }} onClick={e => e.stopPropagation()}>
              {hasPermission('files', 'can_create') && (
                <>
                  <div className="pz-context-item" onClick={() => { handleCreateFolder(); setShowToolbarMenu(false); }}>📁 Klasör Ekle</div>
                  {sidebarFilter !== 'storage' && (
                    <div className="pz-context-item" onClick={() => { handleCreateNote(); setShowToolbarMenu(false); }}>📝 Not Ekle</div>
                  )}
                  <div className="pz-context-sep" />
                  <div className="pz-context-item" onClick={() => { fileInputRef.current.click(); setShowToolbarMenu(false); }}>📤 Dosya Yükle</div>
                  <div className="pz-context-sep" />
                </>
              )}
              <div className="pz-context-item" onClick={() => {
                if (sidebarFilter === 'storage') loadStorageFiles(storageSubPath);
                else loadFiles();
                setShowToolbarMenu(false);
              }}>🔄 Yenile</div>
            </div>
          )}
        </div>
        <input type="file" ref={fileInputRef} style={{ display: 'none' }} multiple onChange={handleFileUpload} />
      </div>

      {/* 2.5 MOBILE LOCATION BAR */}
      {isMobile && (
        <div style={{
          display: 'flex',
          gap: 6,
          padding: '6px 8px',
          background: 'var(--color-surface-alt)',
          borderBottom: '1px solid var(--color-border)',
          overflowX: 'auto',
          flexShrink: 0
        }}>
          <button
            className={`btn btn-xs ${sidebarFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setSidebarFilter('all'); navigateTo(null); }}
            style={{ fontSize: 11, padding: '3px 8px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4, borderRadius: 4 }}
          >
            💻 Kök Dizin
          </button>
          <button
            className={`btn btn-xs ${sidebarFilter === 'mine' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSidebarFilter('mine')}
            style={{ fontSize: 11, padding: '3px 8px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4, borderRadius: 4 }}
          >
            👤 Benim
          </button>
          <button
            className={`btn btn-xs ${sidebarFilter === 'shared' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSidebarFilter('shared')}
            style={{ fontSize: 11, padding: '3px 8px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4, borderRadius: 4 }}
          >
            🤝 Paylaşılan
          </button>
          <button
            className={`btn btn-xs ${sidebarFilter === 'storage' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setSidebarFilter('storage'); pushStorageHistory(''); }}
            style={{ fontSize: 11, padding: '3px 8px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4, borderRadius: 4 }}
          >
            🌐 Ağ Deposu
          </button>
        </div>
      )}

      {/* 3. MAIN SPLIT CONTENT */}
      <div className="pz-split-view">
        {/* SIDEBAR (Desktop Only) */}
        {!isMobile && (
          <div className="pz-sidebar">
            <div className="pz-sidebar-group">Sık Kullanılanlar</div>
            <div 
              className={`pz-sidebar-item ${sidebarFilter === 'all' ? 'active' : ''}`}
              onClick={() => { setSidebarFilter('all'); navigateTo(null); }}
            >
              <span className="icon">💻</span> Kök Dizin
            </div>
            <div 
              className={`pz-sidebar-item ${sidebarFilter === 'mine' ? 'active' : ''}`}
              onClick={() => setSidebarFilter('mine')}
            >
              <span className="icon">👤</span> Benim Dosyalarım
            </div>
            <div 
              className={`pz-sidebar-item ${sidebarFilter === 'shared' ? 'active' : ''}`}
              onClick={() => setSidebarFilter('shared')}
            >
              <span className="icon">🤝</span> Benimle Paylaşılanlar
            </div>
            <div className="pz-sidebar-group" style={{ marginTop: 14 }}>Ağ Sunucusu</div>
            <div 
              className={`pz-sidebar-item ${sidebarFilter === 'storage' ? 'active' : ''}`}
              onClick={() => { setSidebarFilter('storage'); pushStorageHistory(''); }}
            >
              <span className="icon">🌐</span> Ağ Deposu (Storage)
            </div>
          </div>
        )}

        {/* FILE TABLE */}
        <div 
          className="pz-file-view" 
          style={{ position: 'relative' }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => setSelectedFileIds([])} 
          onContextMenu={handleEmptyContextMenu}
        >
          {isDragging && (
            <div className="pz-drag-overlay">
              <div className="pz-drag-overlay-box">
                <div className="pz-drag-overlay-icon">📥</div>
                <div className="pz-drag-overlay-text">Dosyaları Yüklemek İçin Buraya Bırakın</div>
                <div className="pz-drag-overlay-subtext">Çoklu dosya yükleme desteklenmektedir</div>
              </div>
            </div>
          )}
          <table className="pz-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>İsim {sortColumn === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</th>
                <th onClick={() => handleSort('type')} style={{ cursor: 'pointer' }}>Tür {sortColumn === 'type' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</th>
                <th onClick={() => handleSort('size')} style={{ cursor: 'pointer' }}>Boyut {sortColumn === 'size' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</th>
                <th onClick={() => handleSort('owner')} style={{ cursor: 'pointer' }}>Sahibi {sortColumn === 'owner' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</th>
                <th onClick={() => handleSort('date')} style={{ cursor: 'pointer' }}>Tarih {sortColumn === 'date' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</th>
                <th style={{ width: 40, textAlign: 'center' }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {currentFiles.length === 0 && (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: '#888' }}>
                  {loading ? 'Yükleniyor...' : 'Bu klasör boş.'}
                </td></tr>
              )}
              {currentFiles.map(item => (
                <tr 
                  key={item.id} 
                  className={`pz-tr ${selectedFileIds.includes(item.id) ? 'selected' : ''}`}
                  onClick={(e) => {
                    if (isMobile && item.type === 'folder') {
                      e.stopPropagation();
                      handleItemDoubleclick(item);
                    } else {
                      handleItemClick(e, item);
                    }
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    handleItemDoubleclick(item);
                  }}
                  onContextMenu={(e) => handleContextMenu(e, item)}
                >
                  <td className="pz-name-col">
                    <span className="pz-file-icon">{getIcon(item.type)}</span>
                    {editingFileId === item.id ? (
                      <input 
                        type="text" 
                        className="pz-inline-rename-input" 
                        autoFocus
                        value={editingFileName}
                        onChange={e => setEditingFileName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveRename(item);
                          if (e.key === 'Escape') setEditingFileId(null);
                        }}
                        onBlur={() => handleSaveRename(item)}
                        onClick={e => e.stopPropagation()}
                        onDoubleClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <span className="pz-file-name">{item.name}</span>
                    )}

                    {/* Paylaşım Rozetleri */}
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 8, verticalAlign: 'middle' }}>
                      {item.public_share_count > 0 && (
                        <span
                          title="🌐 Herkese Açık Paylaşım Linki Aktif (Yönetmek için tıkla)"
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: '10px',
                            background: 'rgba(59, 130, 246, 0.2)',
                            color: '#60a5fa',
                            border: '1px solid rgba(59, 130, 246, 0.45)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            cursor: 'pointer',
                            boxShadow: '0 0 6px rgba(59, 130, 246, 0.25)',
                            letterSpacing: '0.2px'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            openShareModal(item);
                          }}
                        >
                          🌐 Paylaşıldı
                        </span>
                      )}
                      {item.shared_count > 0 && (
                        <span
                          title={`👥 ${item.shared_count} Sistem Kullanıcısıyla Paylaşıldı (Yönetmek için tıkla)`}
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: '10px',
                            background: 'rgba(168, 85, 247, 0.2)',
                            color: '#c084fc',
                            border: '1px solid rgba(168, 85, 247, 0.45)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            cursor: 'pointer',
                            boxShadow: '0 0 6px rgba(168, 85, 247, 0.25)',
                            letterSpacing: '0.2px'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            openShareModal(item);
                          }}
                        >
                          👥 {item.shared_count}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>{getExt(item)}</td>
                  <td>{item.type === 'file' ? formatBytes(item.size) : '-'}</td>
                  <td>{item.is_storage ? (item.owner_name || 'Storage Server') : (item.user_id === user.id ? 'Ben' : item.owner_name)}</td>
                  <td>{formatDate(item.updated_at || item.created_at)}</td>
                  <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                    <button
                      className="btn btn-xs btn-secondary"
                      style={{ padding: '2px 6px', fontSize: 13, lineHeight: 1, borderRadius: 4 }}
                      title="İşlemler Menüsü"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        handleContextMenu({
                          preventDefault: () => {},
                          stopPropagation: () => {},
                          pageX: Math.min(rect.left, window.innerWidth - 180),
                          pageY: rect.bottom + 4
                        }, item);
                      }}
                    >
                      ⋮
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CONTEXT MENU */}
      {contextMenu && (
        <div 
          className="pz-context-menu" 
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={e => e.stopPropagation()}
        >
          {contextMenu.item.is_storage ? (
            <>
              {contextMenu.item.type === 'folder' && (contextMenu.items || []).length <= 1 && (
                <div className="pz-context-item" onClick={() => { handleItemDoubleclick(contextMenu.item); setContextMenu(null); }}>Aç</div>
              )}
              {contextMenu.item.type === 'file' && (contextMenu.items || []).length <= 1 && (
                <div className="pz-context-item" onClick={() => { handleItemDoubleclick(contextMenu.item); setContextMenu(null); }}>İndir / Görüntüle</div>
              )}
              <div className="pz-context-sep" />
              <div className="pz-context-item" onClick={() => { handleCopy(contextMenu.items || [contextMenu.item]); setContextMenu(null); }}>
                📋 {(contextMenu.items || []).length > 1 ? `${contextMenu.items.length} Öğe Kopyala` : 'Kopyala'}
              </div>
              <div className="pz-context-item" onClick={() => { handleCut(contextMenu.items || [contextMenu.item]); setContextMenu(null); }}>
                ✂️ {(contextMenu.items || []).length > 1 ? `${contextMenu.items.length} Öğe Kes` : 'Kes'}
              </div>
              {clipboard && clipboard.items && clipboard.items.length > 0 && (
                <div className="pz-context-item" onClick={() => { handlePaste(); setContextMenu(null); }}>📋 Buraya Yapıştır</div>
              )}
              <div className="pz-context-sep" />
              {(contextMenu.items || []).length === 1 && (
                <>
                  <div className="pz-context-item" onClick={() => { handleRename(contextMenu.item); setContextMenu(null); }}>✏️ Yeniden Adlandır</div>
                  <div className="pz-context-item" onClick={() => { openShareModal(contextMenu.item); setContextMenu(null); }}>🌐 Paylaş (Link)</div>
                  <div className="pz-context-sep" />
                </>
              )}
              {hasPermission('files', 'can_delete') && (
                <div className="pz-context-item danger" onClick={() => { handleDelete(contextMenu.items || [contextMenu.item]); setContextMenu(null); }}>
                  Sil {(contextMenu.items || []).length > 1 ? `(${contextMenu.items.length} Öğe)` : ''}
                </div>
              )}
            </>
          ) : (
            <>
              {contextMenu.item.type === 'folder' && (contextMenu.items || []).length <= 1 && (
                <div className="pz-context-item" onClick={() => { handleItemDoubleclick(contextMenu.item); setContextMenu(null); }}>Aç</div>
              )}
              {contextMenu.item.type === 'note' && (contextMenu.items || []).length <= 1 && (
                <div className="pz-context-item" onClick={() => { handleItemDoubleclick(contextMenu.item); setContextMenu(null); }}>Düzenle</div>
              )}
              {contextMenu.item.type === 'file' && (contextMenu.items || []).length <= 1 && (
                <div className="pz-context-item" onClick={() => { handleItemDoubleclick(contextMenu.item); setContextMenu(null); }}>İndir / Görüntüle</div>
              )}
              
              <div className="pz-context-sep" />
              <div className="pz-context-item" onClick={() => { handleCopy(contextMenu.items || [contextMenu.item]); setContextMenu(null); }}>
                📋 {(contextMenu.items || []).length > 1 ? `${contextMenu.items.length} Öğe Kopyala` : 'Kopyala'}
              </div>
              <div className="pz-context-item" onClick={() => { handleCut(contextMenu.items || [contextMenu.item]); setContextMenu(null); }}>
                ✂️ {(contextMenu.items || []).length > 1 ? `${contextMenu.items.length} Öğe Kes` : 'Kes'}
              </div>
              {clipboard && clipboard.items && clipboard.items.length > 0 && (
                <div className="pz-context-item" onClick={() => { handlePaste(); setContextMenu(null); }}>📋 Buraya Yapıştır</div>
              )}
              <div className="pz-context-sep" />
              
              {(contextMenu.items || []).length === 1 && (
                <>
                  <div className="pz-context-item" onClick={() => { handleRename(contextMenu.item); setContextMenu(null); }}>✏️ Yeniden Adlandır</div>
                  {contextMenu.item.user_id === user.id && (
                    <div className="pz-context-item" onClick={() => { openShareModal(contextMenu.item); setContextMenu(null); }}>👥 Paylaş</div>
                  )}
                  <div className="pz-context-sep" />
                </>
              )}
              <div className="pz-context-item danger" onClick={() => { handleDelete(contextMenu.items || [contextMenu.item]); setContextMenu(null); }}>
                Sil {(contextMenu.items || []).length > 1 ? `(${contextMenu.items.length} Öğe)` : ''}
              </div>
            </>
          )}
        </div>
      )}

      {/* EMPTY SPACE CONTEXT MENU */}
      {emptyContextMenu && (
        <div 
          className="pz-context-menu" 
          style={{ top: emptyContextMenu.y, left: emptyContextMenu.x }}
          onClick={e => e.stopPropagation()}
        >
          <div className="pz-context-item" onClick={() => { handleCreateFolder(); setEmptyContextMenu(null); }}>📁 Yeni Klasör Ekle</div>
          {sidebarFilter !== 'storage' && (
            <div className="pz-context-item" onClick={() => { handleCreateNote(); setEmptyContextMenu(null); }}>📝 Yeni Not Ekle</div>
          )}
          <div className="pz-context-sep" />
          <div className="pz-context-item" onClick={() => { fileInputRef.current.click(); setEmptyContextMenu(null); }}>📤 Dosya Yükle</div>
          {clipboard && clipboard.items && clipboard.items.length > 0 && (
            <>
              <div className="pz-context-sep" />
              <div className="pz-context-item" onClick={() => { handlePaste(); setEmptyContextMenu(null); }}>📋 Yapıştır</div>
            </>
          )}
          <div className="pz-context-sep" />
          <div className="pz-context-item" onClick={() => { 
            if (sidebarFilter === 'storage') loadStorageFiles(storageSubPath);
            else loadFiles();
            setEmptyContextMenu(null); 
          }}>🔄 Yenile</div>
        </div>
      )}

      {/* Note Modal */}
      {noteModal && (
        <Modal isOpen={true} disableBackdropClick={true} title={noteModal.mode === 'add' ? 'Yeni Not Ekle' : 'Notu Düzenle'} onClose={handleCloseNote} size="lg">
          <div className="form-group" style={{ marginBottom: 15 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Not Başlığı</label>
            <input 
              type="text" 
              className="form-control" 
              value={noteModal.name} 
              onChange={e => setNoteModal({ ...noteModal, name: e.target.value })} 
              disabled={noteModal.mode === 'edit' && files.find(f => f.id === noteModal.id)?.user_id !== user.id}
              style={{ fontWeight: 600, fontSize: 14 }}
            />
          </div>

          {/* Edit / Preview Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: 15, gap: 4 }}>
            <button 
              type="button"
              className={`btn`}
              style={{ 
                padding: '8px 16px', 
                borderRadius: '6px 6px 0 0', 
                border: '1px solid var(--color-border)',
                borderBottom: 'none', 
                fontSize: 12, 
                display: 'flex', 
                alignItems: 'center', 
                gap: 6,
                cursor: 'pointer',
                background: editorTab === 'preview' ? 'var(--color-primary)' : 'var(--color-surface-alt)',
                color: editorTab === 'preview' ? '#fff' : 'var(--color-text)',
                fontWeight: editorTab === 'preview' ? 700 : 500,
                marginBottom: -1,
                zIndex: editorTab === 'preview' ? 2 : 1
              }}
              onClick={() => setEditorTab('preview')}
            >
              👁️ Önizleme (Oku)
            </button>
            <button 
              type="button"
              className={`btn`}
              style={{ 
                padding: '8px 16px', 
                borderRadius: '6px 6px 0 0', 
                border: '1px solid var(--color-border)',
                borderBottom: 'none', 
                fontSize: 12, 
                display: 'flex', 
                alignItems: 'center', 
                gap: 6,
                cursor: 'pointer',
                background: editorTab === 'edit' ? 'var(--color-primary)' : 'var(--color-surface-alt)',
                color: editorTab === 'edit' ? '#fff' : 'var(--color-text)',
                fontWeight: editorTab === 'edit' ? 700 : 500,
                marginBottom: -1,
                zIndex: editorTab === 'edit' ? 2 : 1
              }}
              onClick={() => setEditorTab('edit')}
              disabled={noteModal.mode === 'edit' && files.find(f => f.id === noteModal.id)?.user_id !== user.id}
            >
              📝 Düzenle (Yaz)
            </button>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>İçerik</label>
            
            {editorTab === 'edit' ? (
              <>
                {/* Editor Toolbar */}
                <div style={{
                  display: 'flex',
                  gap: 4,
                  background: 'var(--color-surface-alt)',
                  border: '1px solid var(--color-border)',
                  borderBottom: 'none',
                  borderRadius: '6px 6px 0 0',
                  padding: '6px 10px',
                  alignItems: 'center',
                  flexWrap: 'wrap'
                }}>
                  <button type="button" className="btn btn-secondary btn-xs" style={{ fontWeight: 'bold', minWidth: 28, padding: '4px 6px', fontSize: 11 }} onClick={() => insertAtCursor('**', '**')} title="Kalın">B</button>
                  <button type="button" className="btn btn-secondary btn-xs" style={{ fontStyle: 'italic', minWidth: 28, padding: '4px 6px', fontSize: 11 }} onClick={() => insertAtCursor('*', '*')} title="İtalik">I</button>
                  <div style={{ width: 1, height: 16, background: 'var(--color-border)', margin: '0 4px' }} />
                  <button type="button" className="btn btn-secondary btn-xs" style={{ padding: '4px 6px', fontSize: 11 }} onClick={() => insertAtCursor('# ')} title="Başlık 1">H1</button>
                  <button type="button" className="btn btn-secondary btn-xs" style={{ padding: '4px 6px', fontSize: 11 }} onClick={() => insertAtCursor('## ')} title="Başlık 2">H2</button>
                  <button type="button" className="btn btn-secondary btn-xs" style={{ padding: '4px 6px', fontSize: 11 }} onClick={() => insertAtCursor('### ')} title="Başlık 3">H3</button>
                  <div style={{ width: 1, height: 16, background: 'var(--color-border)', margin: '0 4px' }} />
                  <button type="button" className="btn btn-secondary btn-xs" style={{ padding: '4px 6px', fontSize: 11 }} onClick={() => insertAtCursor('- ')} title="Liste">• Liste</button>
                  <button type="button" className="btn btn-secondary btn-xs" style={{ padding: '4px 6px', fontSize: 11 }} onClick={() => insertAtCursor('- [ ] ')} title="Yapılacaklar">☑ Yapılacak</button>
                  <button type="button" className="btn btn-secondary btn-xs" style={{ padding: '4px 6px', fontSize: 11 }} onClick={() => insertAtCursor('```javascript\n', '\n```')} title="Kod Bloğu">&lt;/&gt;</button>
                  <button type="button" className="btn btn-secondary btn-xs" style={{ padding: '4px 6px', fontSize: 11 }} onClick={() => insertAtCursor('[', '](url)')} title="Bağlantı Ekle">🔗</button>
                </div>
                
                {/* Editor Textarea */}
                <textarea 
                  id="note-textarea"
                  className="form-control" 
                  style={{ 
                    fontFamily: 'monospace', 
                    minHeight: 320, 
                    resize: 'vertical',
                    borderRadius: '0 0 6px 6px',
                    borderTop: 'none',
                    fontSize: 13,
                    lineHeight: 1.5,
                    padding: 12
                  }}
                  value={noteModal.content || ''} 
                  onChange={e => setNoteModal({ ...noteModal, content: e.target.value })}
                  disabled={noteModal.mode === 'edit' && files.find(f => f.id === noteModal.id)?.user_id !== user.id}
                  placeholder="Not içeriğini Markdown formatında yazabilirsiniz..."
                />
              </>
            ) : (
              /* Preview Area */
              <div 
                style={{
                  minHeight: 354,
                  maxHeight: 500,
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 6,
                  padding: '16px 20px',
                  overflowY: 'auto',
                  color: 'var(--color-text)',
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}
                className="markdown-body"
                dangerouslySetInnerHTML={{ __html: parseMarkdown(noteModal.content || '*Bu not henüz boş. Düzenle kısmından yazmaya başlayabilirsiniz.*') }}
              />
            )}
          </div>

          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn btn-secondary" onClick={handleCloseNote}>Kaydetmeden Çık</button>
            {(noteModal.mode === 'add' || files.find(f => f.id === noteModal.id)?.user_id === user.id) && (
              <button className="btn btn-primary" onClick={handleSaveNote}>Kaydet</button>
            )}
          </div>
        </Modal>
      )}

      {/* Share Modal */}
      {shareModal && (
        <Modal isOpen={true} title={`Paylaş: ${shareModal.name}`} onClose={() => setShareModal(null)} size="md">
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: 16, gap: 6 }}>
            {!shareModal.is_storage && (
              <button
                type="button"
                className="btn"
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px 6px 0 0',
                  border: '1px solid var(--color-border)',
                  borderBottom: 'none',
                  fontSize: 12,
                  fontWeight: shareModal.activeTab === 'internal' ? 700 : 500,
                  background: shareModal.activeTab === 'internal' ? 'var(--color-primary)' : 'var(--color-surface-alt)',
                  color: shareModal.activeTab === 'internal' ? '#fff' : 'var(--color-text)',
                  cursor: 'pointer',
                  marginBottom: -1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
                onClick={() => setShareModal({ ...shareModal, activeTab: 'internal' })}
              >
                👥 Sistem Kullanıcıları
              </button>
            )}
            <button
              type="button"
              className="btn"
              style={{
                padding: '8px 16px',
                borderRadius: '6px 6px 0 0',
                border: '1px solid var(--color-border)',
                borderBottom: 'none',
                fontSize: 12,
                fontWeight: shareModal.activeTab === 'public' ? 700 : 500,
                background: shareModal.activeTab === 'public' ? 'var(--color-primary)' : 'var(--color-surface-alt)',
                color: shareModal.activeTab === 'public' ? '#fff' : 'var(--color-text)',
                cursor: 'pointer',
                marginBottom: -1,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
              onClick={() => setShareModal({ ...shareModal, activeTab: 'public' })}
            >
              🌐 Herkese Açık Bağlantı (Public Link)
            </button>
          </div>

          {/* TAB 1: INTERNAL SYSTEM USERS */}
          {shareModal.activeTab === 'internal' && !shareModal.is_storage && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
                Bu dosyayı/klasörü görebilecek sistem kullanıcılarını seçin:
              </p>
              <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 8, padding: 10, background: 'var(--color-surface)' }}>
                {users.filter(u => u.id !== user.id).map(u => (
                  <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px', borderBottom: '1px solid var(--color-surface-alt)', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={shareModal.shared_with.includes(u.id)}
                      onChange={(e) => {
                        const newIds = e.target.checked 
                          ? [...shareModal.shared_with, u.id]
                          : shareModal.shared_with.filter(id => id !== u.id);
                        setShareModal({ ...shareModal, shared_with: newIds });
                      }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{u.full_name || u.username}</span>
                  </label>
                ))}
              </div>
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="btn btn-secondary" onClick={() => setShareModal(null)}>Kapat</button>
                <button className="btn btn-primary" onClick={handleSaveShare}>Kullanıcı Paylaşımlarını Kaydet</button>
              </div>
            </div>
          )}

          {/* TAB 2: PUBLIC SHARE LINK */}
          {shareModal.activeTab === 'public' && (
            <div>
              {shareModal.publicShare ? (
                /* ACTIVE PUBLIC SHARE VIEW */
                <div style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                      Paylaşım Bağlantısı Aktif
                    </span>
                    <button
                      className="btn btn-danger"
                      style={{ padding: '4px 10px', fontSize: 11, borderRadius: 6 }}
                      onClick={() => handleRevokePublicShare(shareModal.publicShare.id)}
                    >
                      🗑️ Bağlantıyı İptal Et
                    </button>
                  </div>

                  {/* Copy Link Input Box */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/share/${shareModal.publicShare.token}`}
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-surface)',
                        color: 'var(--color-text)',
                        fontSize: 13,
                        fontWeight: 600
                      }}
                      onClick={e => e.target.select()}
                    />
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ padding: '0 16px', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, whiteSpace: 'nowrap' }}
                      onClick={() => handleCopyPublicLink(shareModal.publicShare.token)}
                    >
                      {shareModal.copied ? '✓ Kopyalandı' : '📋 Kopyala'}
                    </button>
                  </div>

                  {/* Badges info */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, fontSize: 12 }}>
                    <div style={{ padding: '8px 10px', borderRadius: 6, background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                      <div style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>Şifre Koruması</div>
                      <div style={{ fontWeight: 600, color: shareModal.publicShare.has_password ? '#eab308' : 'var(--color-text)' }}>
                        {shareModal.publicShare.has_password ? '🔒 Şifreli' : 'Şifresiz'}
                      </div>
                    </div>
                    <div style={{ padding: '8px 10px', borderRadius: 6, background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                      <div style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>Geçerlilik</div>
                      <div style={{ fontWeight: 600 }}>
                        {shareModal.publicShare.expires_at ? formatDate(shareModal.publicShare.expires_at) : 'Süresiz ♾️'}
                      </div>
                    </div>
                    <div style={{ padding: '8px 10px', borderRadius: 6, background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                      <div style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>İndirilme Sayısı</div>
                      <div style={{ fontWeight: 600 }}>
                        {shareModal.publicShare.download_count} {shareModal.publicShare.download_limit ? `/ ${shareModal.publicShare.download_limit}` : 'kez'}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* CREATE PUBLIC SHARE FORM */
                <div>
                  <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 14 }}>
                    Bu dosyayı/klasörü kurum dışındaki kişilerle paylaşmak için herkese açık bir bağlantı oluşturun:
                  </p>

                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                      ⏳ Bağlantı Geçerlilik Süresi
                    </label>
                    <select
                      className="form-control"
                      value={shareModal.expires_in_hours}
                      onChange={e => setShareModal({ ...shareModal, expires_in_hours: e.target.value })}
                      style={{ fontSize: 13 }}
                    >
                      <option value="1">1 Saat</option>
                      <option value="24">24 Saat (1 Gün)</option>
                      <option value="168">7 Gün (1 Hafta)</option>
                      <option value="720">30 Gün (1 Ay)</option>
                      <option value="never">Süresiz (İptal edilene kadar geçerli)</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', marginBottom: 6 }}>
                      <input
                        type="checkbox"
                        checked={shareModal.has_password}
                        onChange={e => setShareModal({ ...shareModal, has_password: e.target.checked })}
                      />
                      🔒 Şifre Koruması Ekle
                    </label>
                    {shareModal.has_password && (
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Paylaşım şifresi belirleyin..."
                        value={shareModal.password}
                        onChange={e => setShareModal({ ...shareModal, password: e.target.value })}
                        style={{ fontSize: 13, marginTop: 6 }}
                        autoFocus
                      />
                    )}
                  </div>

                  <div className="form-group" style={{ marginBottom: 18 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                      📥 İndirme Limiti (İsteğe Bağlı)
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="Limitsiz (boş bırakabilirsiniz)"
                      className="form-control"
                      value={shareModal.download_limit}
                      onChange={e => setShareModal({ ...shareModal, download_limit: e.target.value })}
                      style={{ fontSize: 13 }}
                    />
                    <small style={{ color: 'var(--color-text-secondary)', fontSize: 11, marginTop: 4, display: 'block' }}>
                      Belirlenen indirme sayısına ulaşıldığında bağlantı otomatik olarak kapatılır.
                    </small>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button className="btn btn-secondary" onClick={() => setShareModal(null)}>İptal</button>
                    <button
                      className="btn btn-primary"
                      disabled={shareModal.savingPublic}
                      onClick={handleCreatePublicShare}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                    >
                      {shareModal.savingPublic ? 'Oluşturuluyor...' : '🔗 Paylaşım Bağlantısı Oluştur'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}

      {confirmAction && (
        <ConfirmDialog
          title={confirmAction.title}
          message={confirmAction.message}
          type={confirmAction.type}
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {promptAction && (
        <PromptDialog
          title={promptAction.title}
          message={promptAction.message}
          defaultValue={promptAction.defaultValue}
          onConfirm={promptAction.onConfirm}
          onCancel={() => setPromptAction(null)}
        />
      )}
      {/* Upload progress overlay */}
      {uploading && (
        <div className="pz-upload-overlay">
          <div className="pz-upload-card">
            <div className="pz-upload-header">
              <span className="pz-upload-title">Dosya Yükleniyor...</span>
              <span className="pz-upload-percent">%{uploadProgress}</span>
            </div>
            <div className="pz-upload-filename" title={uploadFileName}>{uploadFileName}</div>
            <div className="pz-upload-progress-bg">
              <div className="pz-upload-progress-bar" style={{ width: `${uploadProgress}%` }} />
            </div>
            <div className="pz-upload-footer">
              <span className="pz-upload-bytes">{uploadProgressBytes}</span>
              <div className="pz-upload-spinner" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const parseMarkdown = (md) => {
  if (!md) return '';
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code Blocks
  html = html.replace(/```([\s\S]+?)```/g, (match, code) => {
    return `<pre style="background: var(--color-surface-alt); padding: 12px; border-radius: 6px; border: 1px solid var(--color-border); font-family: monospace; font-size: 12px; overflow-x: auto; margin: 10px 0; color: var(--color-text);">${code.trim()}</pre>`;
  });

  // Inline Code
  html = html.replace(/`([^`]+)`/g, '<code style="background: var(--color-surface-alt); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 12px; color: var(--color-danger);">$1</code>');

  // Headers (H3 to H1)
  html = html.replace(/^### (.*$)/gim, '<h3 style="font-size: 15px; margin: 12px 0 6px; font-weight: 700; color: var(--color-text); border-bottom: 1px solid var(--color-border); padding-bottom: 4px;">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 style="font-size: 18px; margin: 16px 0 8px; font-weight: 700; color: var(--color-text); border-bottom: 1px solid var(--color-border); padding-bottom: 4px;">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 style="font-size: 22px; margin: 20px 0 10px; font-weight: 700; color: var(--color-text); border-bottom: 1px solid var(--color-border); padding-bottom: 6px;">$1</h1>');

  // Checkboxes (checked and unchecked)
  html = html.replace(/^- \[x\] (.*$)/gim, '<div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;"><input type="checkbox" checked disabled style="margin: 0;" /> <span style="text-decoration: line-through; opacity: 0.6;">$1</span></div>');
  html = html.replace(/^- \[ \] (.*$)/gim, '<div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;"><input type="checkbox" disabled style="margin: 0;" /> <span>$1</span></div>');

  // Unordered list items (bullets)
  html = html.replace(/^- (?!\[[ x]\])(.*$)/gim, '<li style="margin-left: 20px; list-style-type: disc; margin-bottom: 4px;">$1</li>');

  // Bold / Italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color: var(--color-primary-light); text-decoration: underline; font-weight: 600;">$1</a>');

  // Paragraph breaks (preserving double linebreaks)
  html = html.split('\n').map(line => {
    if (line.trim().startsWith('<h') || line.trim().startsWith('<pre') || line.trim().startsWith('<div') || line.trim().startsWith('<li') || line.trim() === '') {
      return line;
    }
    return `<p style="margin: 6px 0; line-height: 1.5; font-size: 13px;">${line}</p>`;
  }).join('\n');

  return html;
};
