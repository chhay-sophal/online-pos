import React, { useState, useEffect } from 'react';
import { useBackend } from './BackendContext';
import { ArrowLeft, Store, Globe, ArrowLeftRight, Wallet, Smartphone, Banknote, CheckCircle2, AlertTriangle, AlertOctagon, HardDrive, RotateCcw, Download, FolderOpen, X, RefreshCw } from 'lucide-react';
import { translations as t } from './locales';

export default function SettingsManager({ onBackToRegister, currentLocale, onLocaleChange, mainCurrency, onCurrencyChange }) {
  const BACKEND_URL = useBackend();
  const DEFAULT_SETTINGS = {
    store_name: '',
    store_icon: '',
    exchange_rate: '4100',
    bakong_account_id: '',
    bakong_merchant_name: '',
    bakong_merchant_city: '',
    locale: 'km',
    main_currency: 'USD'
  };

  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS });
  const [initialSettings, setInitialSettings] = useState({ ...DEFAULT_SETTINGS });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const [updateCheck, setUpdateCheck] = useState('idle'); // idle | checking | available | uptodate | error
  const [pendingUpdate, setPendingUpdate] = useState(null);
  const [updateProgress, setUpdateProgress] = useState(0);

  const [backups, setBackups] = useState([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState(null);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  const [exportingFile, setExportingFile] = useState(null);
  const [exportedFile, setExportedFile] = useState(null);
  const [cloudFolder, setCloudFolder] = useState('');
  const [cloudFolderSaving, setCloudFolderSaving] = useState(false);

  const IS_TAURI = Boolean(window.__TAURI_INTERNALS__ ?? window.__TAURI__);

  useEffect(() => {
    fetchSettings();
    fetchBackups();
  }, []);

  useEffect(() => {
    if (!IS_TAURI) return;
    import('@tauri-apps/api/app')
      .then(({ getVersion }) => getVersion())
      .then(setAppVersion)
      .catch(() => {});
  }, [IS_TAURI]);

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/settings`);
      if (response.ok) {
        const data = await response.json();
        setSettings(prev => ({ ...prev, ...data }));
        setInitialSettings(data);
        setCloudFolder(data.cloud_backup_folder || '');
      }
    } catch (err) {
      console.error('Failed to load store settings:', err);
    }
  };

  const fetchBackups = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/backup/list`);
      if (res.ok) setBackups(await res.json());
    } catch {}
  };

  const handleBackupNow = async () => {
    setBackupLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/backup/now`, { method: 'POST' });
      if (res.ok) {
        setBackupSuccess(true);
        setTimeout(() => setBackupSuccess(false), 3000);
        fetchBackups();
      }
    } catch {}
    setBackupLoading(false);
  };

  const handleConfirmRestore = async () => {
    if (!restoreConfirm) return;
    setRestoreLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/backup/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: restoreConfirm }),
      });
      if (res.ok) {
        setRestoreConfirm(null);
        setRestoreSuccess(true);
      }
    } catch {}
    setRestoreLoading(false);
  };

  const handleExport = async (filename) => {
    if (!IS_TAURI) return;
    setExportingFile(filename);
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const destPath = await save({
        defaultPath: filename,
        filters: [{ name: 'SQLite Database', extensions: ['sqlite'] }],
      });
      if (!destPath) { setExportingFile(null); return; }
      const res = await fetch(`${BACKEND_URL}/api/backup/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, destPath }),
      });
      if (res.ok) {
        setExportedFile(filename);
        setTimeout(() => setExportedFile(null), 3000);
      } else {
        const err = await res.json();
        alert(err.error || 'Export failed');
      }
    } catch (err) {
      alert('Export failed: ' + err.message);
    }
    setExportingFile(null);
  };

  const saveCloudFolder = async (folder) => {
    setCloudFolderSaving(true);
    try {
      await fetch(`${BACKEND_URL}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cloud_backup_folder: folder }),
      });
      setCloudFolder(folder);
    } catch {}
    setCloudFolderSaving(false);
  };

  const handlePickCloudFolder = async () => {
    if (!IS_TAURI) return;
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true, multiple: false, title: 'Choose cloud backup folder' });
      if (selected) await saveCloudFolder(selected);
    } catch {}
  };

  const handleClearCloudFolder = async () => {
    await saveCloudFolder('');
  };

  const formatBackupName = (filename) => {
    const m = filename.match(/database-(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})\.sqlite/);
    if (!m) return filename;
    const [, y, mo, d, h, min] = m;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(mo, 10) - 1]} ${parseInt(d, 10)}, ${y} · ${h}:${min}`;
  };

  const handleSubmitTrigger = (e) => {
    e.preventDefault();
    setShowConfirmPopup(true);
  };

  const handleConfirmSave = async () => {
    setShowConfirmPopup(false);
    try {
      const response = await fetch(`${BACKEND_URL}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        onLocaleChange(settings.locale);
        onCurrencyChange(settings.main_currency);
        setInitialSettings(settings);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert(t[currentLocale]?.settingsPage?.failSave || 'Failed to save settings.');
      }
    } catch (err) {
      console.error('Error pushing updated options:', err);
    }
  };

  // General dirty form change tracker — use ?? '' so keys missing from the API
  // response (e.g. store_name before first save) don't cause a permanent dirty state.
  const hasChanges = Object.keys(settings).some(
    key => String(settings[key] ?? '') !== String(initialSettings[key] ?? '')
  );

  // Evaluation conditions for core financial changes
  const isCurrencyChanged = initialSettings && String(settings.main_currency) !== String(initialSettings.main_currency);
  const isExchangeRateChanged = initialSettings && String(settings.exchange_rate) !== String(initialSettings.exchange_rate);

  // Everything under KHQR is evaluated as a critical parameter
  const isBakongAccountIdChanged = initialSettings && String(settings.bakong_account_id) !== String(initialSettings.bakong_account_id);
  const isBakongMerchantNameChanged = initialSettings && String(settings.bakong_merchant_name) !== String(initialSettings.bakong_merchant_name);
  const isBakongMerchantCityChanged = initialSettings && String(settings.bakong_merchant_city) !== String(initialSettings.bakong_merchant_city);

  const hasKhqrChanges = isBakongAccountIdChanged || isBakongMerchantNameChanged || isBakongMerchantCityChanged;
  const hasCriticalChanges = isCurrencyChanged || isExchangeRateChanged || hasKhqrChanges;

  const currentTranslations = t[currentLocale] || {};
  const s = currentTranslations.settingsPage || {};

  const handleCheckUpdate = async () => {
    if (!IS_TAURI || updateCheck === 'checking' || updateCheck === 'downloading') return;
    setUpdateCheck('checking');
    setPendingUpdate(null);
    setUpdateProgress(0);
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (!update) { setUpdateCheck('uptodate'); return; }
      setPendingUpdate(update);
      setUpdateCheck('available');
    } catch {
      setUpdateCheck('error');
    }
  };

  const handleInstallUpdate = async () => {
    if (!pendingUpdate) return;
    setUpdateCheck('downloading');
    setUpdateProgress(0);
    try {
      const { relaunch } = await import('@tauri-apps/plugin-process');
      let downloaded = 0;
      let total = 0;
      await pendingUpdate.downloadAndInstall((event) => {
        if (event.event === 'Started') { total = event.data.contentLength ?? 0; }
        else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          if (total > 0) setUpdateProgress(Math.round((downloaded / total) * 100));
        } else if (event.event === 'Finished') { setUpdateProgress(100); }
      });
      await relaunch();
    } catch {
      setUpdateCheck('error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col font-sans text-slate-900 dark:text-white antialiased relative overflow-hidden">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center gap-4 shadow-xs flex-shrink-0 z-10">
        <button
          onClick={onBackToRegister}
          className="px-3.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 border border-transparent hover:border-slate-200 dark:hover:border-slate-600 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft size={14} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight font-display">
            {currentTranslations.settings || 'Settings'}
          </h1>
          <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 tracking-wider uppercase">
            {s.auditRoom || 'Terminal Configuration'}
          </p>
        </div>
      </header>

      {/* Main Container - Adjusted layout heights with scrollability configurations */}
      <div className="flex-1 p-4 md:p-6 max-w-2xl mx-auto w-full overflow-hidden flex flex-col">
        <form
          onSubmit={handleSubmitTrigger}
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xs flex flex-col max-h-[calc(100vh-120px)] overflow-hidden"
        >
          {/* Scrollable body partition block */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">

            {/* Section: Store Profile */}
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700/50 pb-2 mb-4 font-display flex items-center gap-1.5">
                <Store size={14} />{s.storeProfileHeader || 'Store Profile'}
              </h2>
              <div className="flex gap-4 items-start">
                {/* Icon upload */}
                <div className="flex flex-col items-center gap-2 flex-shrink-0">
                  <div className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center bg-slate-50 dark:bg-slate-900 overflow-hidden">
                    {settings.store_icon
                      ? <img src={settings.store_icon} alt="store icon" className="w-full h-full object-cover" />
                      : <Store size={24} className="text-slate-400 dark:text-slate-500" />}
                  </div>
                  <label className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide cursor-pointer hover:text-indigo-800 dark:hover:text-indigo-200 transition-colors">
                    {s.uploadIcon || 'Upload'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (ev) => setSettings({ ...settings, store_icon: ev.target.result });
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                  {settings.store_icon && (
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, store_icon: '' })}
                      className="text-[10px] font-bold text-slate-400 dark:text-slate-500 hover:text-red-500 uppercase tracking-wide transition-colors cursor-pointer"
                    >
                      {s.removeIcon || 'Remove'}
                    </button>
                  )}
                </div>
                {/* Store name */}
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide font-display">
                    {s.storeNameLabel || 'Store Display Name'}
                  </label>
                  <input
                    type="text"
                    value={settings.store_name}
                    onChange={(e) => setSettings({ ...settings, store_name: e.target.value })}
                    className="w-full mt-1.5 p-2.5 border border-slate-200 bg-slate-50 rounded-lg text-sm font-bold text-slate-700 focus:outline-none focus:border-indigo-500 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700"
                    placeholder={s.storeNamePlaceholder || 'My Store'}
                  />
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-display">
                    {s.storeNameHelp || 'Shown in the top-left corner of the register.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Section: Language Selection */}
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700/50 pb-2 mb-4 font-display flex items-center gap-1.5">
                <Globe size={14} />{s.languageHeader || 'Language'}
              </h2>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide font-display">
                {s.terminalLang || 'Terminal Display Language'}
              </label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, locale: 'km' })}
                  className={`py-3 px-4 rounded-xl border font-bold text-sm transition-all flex items-center justify-center gap-2 font-display cursor-pointer ${
                    settings.locale === 'km'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  🇰🇭 ភាសាខ្មែរ (Khmer)
                </button>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, locale: 'en' })}
                  className={`py-3 px-4 rounded-xl border font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    settings.locale === 'en'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  🇺🇸 English (EN)
                </button>
              </div>
            </div>

            {/* Section: Base Currency Configuration (CRITICAL FIELD) */}
            <div className={`p-4 rounded-xl transition-all duration-300 ${isCurrencyChanged ? 'bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800' : ''}`}>
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/50 pb-2 mb-4">
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider font-display flex items-center gap-1.5">
                  <ArrowLeftRight size={14} />{s.currencyHeader || 'Currency'}
                </h2>
                {isCurrencyChanged && (
                  <span className="px-2.5 py-0.5 bg-amber-500 text-[10px] font-black text-white rounded-md tracking-wider uppercase animate-pulse">
                    <AlertTriangle size={10} className="inline mr-1" />{s.criticalBadge || 'CRITICAL CHANGE'}
                  </span>
                )}
              </div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide font-display">
                {s.selectPrimaryCurr || 'Select Primary Transactional Currency'}
              </label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, main_currency: 'USD' })}
                  className={`py-3 px-4 rounded-xl border font-bold text-sm transition-all flex items-center justify-center gap-2 font-display cursor-pointer ${
                    settings.main_currency === 'USD'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Banknote size={16} /> {currentTranslations.mainCurrencyUsd || 'US Dollar (USD)'}
                </button>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, main_currency: 'KHR' })}
                  className={`py-3 px-4 rounded-xl border font-bold text-sm transition-all flex items-center justify-center gap-2 font-display cursor-pointer ${
                    settings.main_currency === 'KHR'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  🇰🇭 {currentTranslations.mainCurrencyKhr || 'Khmer Riel (KHR)'}
                </button>
              </div>
            </div>

            {/* Section: Financial Parameters (CRITICAL FIELD) */}
            <div className={`p-4 rounded-xl transition-all duration-300 ${isExchangeRateChanged ? 'bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800' : ''}`}>
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/50 pb-2 mb-4">
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider font-display flex items-center gap-1.5">
                  <Wallet size={14} />{s.financialsHeader || 'Financials'}
                </h2>
                {isExchangeRateChanged && (
                  <span className="px-2.5 py-0.5 bg-amber-500 text-[10px] font-black text-white rounded-md tracking-wider uppercase animate-pulse">
                    <AlertTriangle size={10} className="inline mr-1" />{s.criticalBadge || 'CRITICAL CHANGE'}
                  </span>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide font-display">
                  {currentTranslations.exchangeRate || 'Exchange Rate'} (1 USD = ? KHR)
                </label>
                <input
                  type="number"
                  value={settings.exchange_rate}
                  onChange={(e) => setSettings({...settings, exchange_rate: e.target.value})}
                  className="w-full mt-1.5 p-2.5 border border-slate-200 bg-slate-50 rounded-lg text-sm font-bold tracking-wide focus:outline-none focus:border-indigo-500 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700"
                  placeholder="4100"
                />
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-display">
                  {s.exchangeRateHelp || 'Used to automatically calculate Riel checkout conversions.'}
                </p>
              </div>
            </div>

            {/* Section: KHQR Profiles (WHOLE SEGMENT MARKED AS CRITICAL RE-ROUTING LAYER) */}
            <div className={`p-4 rounded-xl transition-all duration-300 ${hasKhqrChanges ? 'bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800' : ''}`}>
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/50 pb-2 mb-4">
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider font-display flex items-center gap-1.5">
                  <Smartphone size={14} />{s.bakongHeader || 'KHQR Profile'}
                </h2>
                {hasKhqrChanges && (
                  <span className="px-2.5 py-0.5 bg-amber-500 text-[10px] font-black text-white rounded-md tracking-wider uppercase animate-pulse">
                    <AlertTriangle size={10} className="inline mr-1" />{s.criticalBadge || 'CRITICAL CHANGE'}
                  </span>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide font-display">
                      {s.bakongAccountId || 'Bakong Account ID'}
                    </label>
                  </div>
                  <input
                    type="text"
                    value={settings.bakong_account_id}
                    onChange={(e) => setSettings({...settings, bakong_account_id: e.target.value})}
                    className={`w-full mt-1.5 p-2.5 border bg-slate-50 rounded-lg text-sm text-indigo-600 focus:outline-none focus:border-indigo-500 dark:bg-slate-800 dark:text-indigo-400 dark:border-slate-700 ${isBakongAccountIdChanged ? 'border-amber-300 dark:border-amber-700 ring-2 ring-amber-100/50 dark:ring-amber-900/30' : 'border-slate-200 dark:border-slate-700'}`}
                    placeholder="store_account@abaa"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide font-display">
                      {s.shopNameLabel || 'Display Shop Name'}
                    </label>
                    <input
                      type="text"
                      value={settings.bakong_merchant_name}
                      onChange={(e) => setSettings({...settings, bakong_merchant_name: e.target.value})}
                      className={`w-full mt-1.5 p-2.5 border bg-slate-50 rounded-lg text-sm font-medium font-display focus:outline-none focus:border-indigo-500 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700 ${isBakongMerchantNameChanged ? 'border-amber-300 dark:border-amber-700 ring-2 ring-amber-100/50 dark:ring-amber-900/30' : 'border-slate-200 dark:border-slate-700'}`}
                      placeholder="Baby Mart"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide font-display">
                      {s.storeCityLabel || 'Store Operating City'}
                    </label>
                    <input
                      type="text"
                      value={settings.bakong_merchant_city}
                      onChange={(e) => setSettings({...settings, bakong_merchant_city: e.target.value})}
                      className={`w-full mt-1.5 p-2.5 border bg-slate-50 rounded-lg text-sm font-medium font-display focus:outline-none focus:border-indigo-500 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700 ${isBakongMerchantCityChanged ? 'border-amber-300 dark:border-amber-700 ring-2 ring-amber-100/50 dark:ring-amber-900/30' : 'border-slate-200 dark:border-slate-700'}`}
                      placeholder="Phnom Penh"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section: Data Backup */}
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/50 pb-2 mb-4">
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider font-display flex items-center gap-1.5">
                  <HardDrive size={14} />{s.backupSection?.header || 'Data Backup'}
                </h2>
                <button
                  type="button"
                  onClick={handleBackupNow}
                  disabled={backupLoading}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <HardDrive size={12} />
                  {backupLoading ? '...' : (s.backupSection?.backupNow || 'Backup Now')}
                </button>
              </div>

              {/* Cloud backup folder picker */}
              {IS_TAURI && (
                <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <FolderOpen size={12} />
                      {s.backupSection?.cloudFolderLabel || 'Cloud Sync Folder'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {cloudFolder && (
                        <button
                          type="button"
                          onClick={handleClearCloudFolder}
                          disabled={cloudFolderSaving}
                          className="p-1 text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 transition-colors disabled:opacity-50 cursor-pointer"
                          title="Remove folder"
                        >
                          <X size={12} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handlePickCloudFolder}
                        disabled={cloudFolderSaving}
                        className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-500 dark:text-slate-400 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <FolderOpen size={10} />
                        {cloudFolderSaving ? '...' : (s.backupSection?.chooseFolder || 'Choose Folder')}
                      </button>
                    </div>
                  </div>
                  {cloudFolder ? (
                    <p className="mt-1.5 text-[10px] text-indigo-600 dark:text-indigo-400 font-mono break-all leading-relaxed">{cloudFolder}</p>
                  ) : (
                    <p className="mt-1.5 text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
                      {s.backupSection?.cloudFolderHint || 'Not set. Point to your OneDrive, Google Drive, or Dropbox folder to auto-sync backups.'}
                    </p>
                  )}
                </div>
              )}

              {backupSuccess && (
                <div className="mb-3 p-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                  <CheckCircle2 size={13} />{s.backupSection?.backupSuccess || 'Backup created successfully!'}
                </div>
              )}

              {restoreSuccess ? (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-700 dark:text-amber-400 font-bold flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 size={13} />{s.backupSection?.restoreSuccess || 'Database restored! Please reload the app.'}
                  </span>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold cursor-pointer whitespace-nowrap"
                  >
                    {s.backupSection?.reloadBtn || 'Reload App'}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {backups.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4 leading-relaxed">
                      {s.backupSection?.noBackups || 'No backups yet. A backup is created automatically each time the app starts.'}
                    </p>
                  ) : (
                    backups.map(b => (
                      <div key={b.name} className="flex items-center justify-between py-2 px-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-700">
                        <div>
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{formatBackupName(b.name)}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">{(b.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {IS_TAURI && (
                            <button
                              type="button"
                              onClick={() => handleExport(b.name)}
                              disabled={exportingFile === b.name}
                              className={`px-2.5 py-1 border rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                                exportedFile === b.name
                                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {exportedFile === b.name
                                ? <><CheckCircle2 size={10} />{s.backupSection?.exportDone || 'Saved!'}</>
                                : exportingFile === b.name
                                  ? '...'
                                  : <><Download size={10} />{s.backupSection?.export || 'Export'}</>
                              }
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setRestoreConfirm(b.name)}
                            className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-400 text-slate-500 dark:text-slate-400 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw size={10} />{s.backupSection?.restore || 'Restore'}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

          </div>

          {/* Fixed Action Control Footer Layout Segment */}
          {(hasChanges || saveSuccess) && (
            <div className="p-4 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between flex-shrink-0 animate-fadeIn">
              {saveSuccess ? (
                <span className="text-emerald-600 dark:text-emerald-400 text-sm font-bold flex items-center gap-1.5 font-display">
                  <CheckCircle2 size={16} /> {s.saveSuccess || 'Changes stored securely!'}
                </span>
              ) : <div />}

              {hasChanges && (
                <button
                  type="submit"
                  className={`px-6 py-2.5 font-bold rounded-xl text-sm shadow-xs transition-colors font-display cursor-pointer ${hasCriticalChanges ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
                >
                  {s.commitSave || 'Commit Configuration Save'}
                </button>
              )}
            </div>
          )}
        </form>
        {appVersion && (
          <div className="flex flex-col items-center gap-2 mt-3">
            <p className="text-[11px] text-slate-400 dark:text-slate-500">SOSO POS v{appVersion}</p>
            {IS_TAURI && updateCheck !== 'downloading' && (
              <button
                onClick={handleCheckUpdate}
                disabled={updateCheck === 'checking'}
                className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={11} className={updateCheck === 'checking' ? 'animate-spin' : ''} />
                {updateCheck === 'checking' ? 'Checking...' : updateCheck === 'uptodate' ? 'You\'re up to date' : updateCheck === 'error' ? 'Check failed — try again' : 'Check for updates'}
              </button>
            )}
            {updateCheck === 'available' && pendingUpdate && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">v{pendingUpdate.version} available</span>
                <button
                  onClick={handleInstallUpdate}
                  className="px-2.5 py-1 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                >
                  Install & Restart
                </button>
              </div>
            )}
            {updateCheck === 'downloading' && (
              <div className="w-40 flex flex-col items-center gap-1">
                <p className="text-[11px] text-slate-400">{updateProgress > 0 ? `Downloading ${updateProgress}%` : 'Downloading...'}</p>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1 overflow-hidden">
                  <div
                    className="h-1 rounded-full bg-indigo-600 transition-all"
                    style={{ width: updateProgress > 0 ? `${updateProgress}%` : '30%' }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECURE POPUP DIALOG WITH INTEGRATED RISK WARNER FOR MERCHANT PROFILES */}
      {showConfirmPopup && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className={`bg-white dark:bg-slate-800 rounded-2xl border shadow-xl max-w-sm w-full overflow-hidden p-6 space-y-4 transform scale-100 transition-all ${hasCriticalChanges ? 'border-amber-300 dark:border-amber-700 ring-4 ring-amber-50 dark:ring-amber-900/30' : 'border-slate-200 dark:border-slate-700'}`}>
            <div className={`flex items-center gap-3 ${hasCriticalChanges ? 'text-red-500' : 'text-amber-500'}`}>
              {hasCriticalChanges ? <AlertOctagon size={24} /> : <AlertTriangle size={24} />}
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">
                {hasCriticalChanges
                  ? (s.criticalPopupTitle || 'WARNING: Critical Shift')
                  : (s.popupTitle || 'Confirm Settings Change')}
              </h3>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
              {hasCriticalChanges
                ? (s.criticalPopupBody || 'You are altering core financial fields or routing channels that affect settlement calculations.')
                : (s.popupBody || 'Are you sure you want to update and commit these changes?')}
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmPopup(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
              >
                {s.popupCancel || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                className={`px-4 py-2 text-white rounded-xl text-xs font-bold transition-colors shadow-xs ${hasCriticalChanges ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}
              >
                {s.popupConfirm || 'Yes, Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESTORE CONFIRMATION DIALOG */}
      {restoreConfirm && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-amber-300 dark:border-amber-700 ring-4 ring-amber-50 dark:ring-amber-900/30 shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-amber-500">
              <RotateCcw size={24} />
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">
                {s.backupSection?.restoreConfirmTitle || 'Restore this backup?'}
              </h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
              {s.backupSection?.restoreConfirmBody || 'All current data will be replaced with the selected backup. This cannot be undone.'}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-mono bg-slate-50 dark:bg-slate-900 rounded-lg px-3 py-2 break-all">
              {formatBackupName(restoreConfirm)}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRestoreConfirm(null)}
                disabled={restoreLoading}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                {s.backupSection?.cancel || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={restoreLoading}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
              >
                {restoreLoading ? '...' : (s.backupSection?.restoreConfirmBtn || 'Yes, Restore')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
