import React, { useState, useEffect } from 'react';
import { translations as t } from './locales';

export default function SettingsManager({ onBackToRegister, currentLocale, onLocaleChange, mainCurrency, onCurrencyChange }) {
  const [settings, setSettings] = useState({
    exchange_rate: '4100',
    bakong_account_id: '',
    bakong_merchant_name: '',
    bakong_merchant_city: '',
    locale: 'km',
    main_currency: 'USD'
  });
  
  const [initialSettings, setInitialSettings] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  
  const BACKEND_URL = (import.meta.env.PROD && !window.__TAURI__) ? '' : 'http://localhost:5050';

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/settings`);
      if (response.ok) {
        const data = await response.json();
        setSettings(prev => ({ ...prev, ...data }));
        setInitialSettings(data);
      }
    } catch (err) {
      console.error('Failed to load store settings:', err);
    }
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

  // General dirty form change tracker
  const hasChanges = initialSettings 
    ? Object.keys(settings).some(key => String(settings[key]) !== String(initialSettings[key]))
    : false;

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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 antialiased relative overflow-hidden">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4 shadow-xs flex-shrink-0 z-10">
        <button 
          onClick={onBackToRegister}
          className="px-3.5 py-1.5 hover:bg-slate-100 border border-transparent hover:border-slate-200 rounded-xl text-xs font-bold text-slate-600 transition-all flex items-center gap-1.5 cursor-pointer"
        >
          ← {currentTranslations.register || 'Register'}
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight font-display">
            {currentTranslations.settings || 'Settings'}
          </h1>
          <p className="text-xs font-bold text-indigo-600 tracking-wider uppercase">
            {s.auditRoom || 'Terminal Configuration'}
          </p>
        </div>
      </header>

      {/* Main Container - Adjusted layout heights with scrollability configurations */}
      <div className="flex-1 p-4 md:p-6 max-w-2xl mx-auto w-full overflow-hidden flex flex-col">
        <form 
          onSubmit={handleSubmitTrigger} 
          className="bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col max-h-[calc(100vh-120px)] overflow-hidden"
        >
          {/* Scrollable body partition block */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
            
            {/* Section: Language Selection */}
            <div>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 mb-4 font-display">
                {s.languageHeader || '🌐 Language'}
              </h2>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide font-display">
                {s.terminalLang || 'Terminal Display Language'}
              </label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, locale: 'km' })}
                  className={`py-3 px-4 rounded-xl border font-bold text-sm transition-all flex items-center justify-center gap-2 font-display cursor-pointer ${
                    settings.locale === 'km' 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
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
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  🇺🇸 English (EN)
                </button>
              </div>
            </div>

            {/* Section: Base Currency Configuration (CRITICAL FIELD) */}
            <div className={`p-4 rounded-xl transition-all duration-300 ${isCurrencyChanged ? 'bg-amber-50/70 border border-amber-200' : ''}`}>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-4">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-display">
                  {s.currencyHeader || '💱 Currency'}
                </h2>
                {isCurrencyChanged && (
                  <span className="px-2.5 py-0.5 bg-amber-500 text-[10px] font-black text-white rounded-md tracking-wider uppercase animate-pulse">
                    {s.criticalBadge || '⚠️ CRITICAL CHANGE'}
                  </span>
                )}
              </div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide font-display">
                {s.selectPrimaryCurr || 'Select Primary Transactional Currency'}
              </label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, main_currency: 'USD' })}
                  className={`py-3 px-4 rounded-xl border font-bold text-sm transition-all flex items-center justify-center gap-2 font-display cursor-pointer ${
                    settings.main_currency === 'USD' 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  💵 {currentTranslations.mainCurrencyUsd || 'US Dollar (USD)'}
                </button>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, main_currency: 'KHR' })}
                  className={`py-3 px-4 rounded-xl border font-bold text-sm transition-all flex items-center justify-center gap-2 font-display cursor-pointer ${
                    settings.main_currency === 'KHR' 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  🇰🇭 {currentTranslations.mainCurrencyKhr || 'Khmer Riel (KHR)'}
                </button>
              </div>
            </div>

            {/* Section: Financial Parameters (CRITICAL FIELD) */}
            <div className={`p-4 rounded-xl transition-all duration-300 ${isExchangeRateChanged ? 'bg-amber-50/70 border border-amber-200' : ''}`}>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-4">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-display">
                  {s.financialsHeader || '💰 Financials'}
                </h2>
                {isExchangeRateChanged && (
                  <span className="px-2.5 py-0.5 bg-amber-500 text-[10px] font-black text-white rounded-md tracking-wider uppercase animate-pulse">
                    {s.criticalBadge || '⚠️ CRITICAL CHANGE'}
                  </span>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide font-display">
                  {currentTranslations.exchangeRate || 'Exchange Rate'} (1 USD = ? KHR)
                </label>
                <input 
                  type="number"
                  value={settings.exchange_rate}
                  onChange={(e) => setSettings({...settings, exchange_rate: e.target.value})}
                  className="w-full mt-1.5 p-2.5 border border-slate-200 bg-slate-50 rounded-lg text-sm font-bold tracking-wide font-mono focus:outline-none focus:border-indigo-500"
                  placeholder="4100"
                />
                <p className="text-xs text-slate-400 mt-1 font-display">
                  {s.exchangeRateHelp || 'Used to automatically calculate Riel checkout conversions.'}
                </p>
              </div>
            </div>

            {/* Section: KHQR Profiles (WHOLE SEGMENT MARKED AS CRITICAL RE-ROUTING LAYER) */}
            <div className={`p-4 rounded-xl transition-all duration-300 ${hasKhqrChanges ? 'bg-amber-50/70 border border-amber-200' : ''}`}>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-4">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-display">
                  {s.bakongHeader || '📱 KHQR Profile'}
                </h2>
                {hasKhqrChanges && (
                  <span className="px-2.5 py-0.5 bg-amber-500 text-[10px] font-black text-white rounded-md tracking-wider uppercase animate-pulse">
                    {s.criticalBadge || '⚠️ CRITICAL CHANGE'}
                  </span>
                )}
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide font-display">
                      {s.bakongAccountId || 'Bakong Account ID'}
                    </label>
                  </div>
                  <input 
                    type="text"
                    value={settings.bakong_account_id}
                    onChange={(e) => setSettings({...settings, bakong_account_id: e.target.value})}
                    className={`w-full mt-1.5 p-2.5 border bg-slate-50 rounded-lg text-sm font-mono text-indigo-600 focus:outline-none focus:border-indigo-500 ${isBakongAccountIdChanged ? 'border-amber-300 ring-2 ring-amber-100/50' : 'border-slate-200'}`}
                    placeholder="store_account@abaa"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide font-display">
                      {s.shopNameLabel || 'Display Shop Name'}
                    </label>
                    <input 
                      type="text"
                      value={settings.bakong_merchant_name}
                      onChange={(e) => setSettings({...settings, bakong_merchant_name: e.target.value})}
                      className={`w-full mt-1.5 p-2.5 border bg-slate-50 rounded-lg text-sm font-medium font-display focus:outline-none focus:border-indigo-500 ${isBakongMerchantNameChanged ? 'border-amber-300 ring-2 ring-amber-100/50' : 'border-slate-200'}`}
                      placeholder="Baby Mart"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide font-display">
                      {s.storeCityLabel || 'Store Operating City'}
                    </label>
                    <input 
                      type="text"
                      value={settings.bakong_merchant_city}
                      onChange={(e) => setSettings({...settings, bakong_merchant_city: e.target.value})}
                      className={`w-full mt-1.5 p-2.5 border bg-slate-50 rounded-lg text-sm font-medium font-display focus:outline-none focus:border-indigo-500 ${isBakongMerchantCityChanged ? 'border-amber-300 ring-2 ring-amber-100/50' : 'border-slate-200'}`}
                      placeholder="Phnom Penh"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Fixed Action Control Footer Layout Segment */}
          {(hasChanges || saveSuccess) && (
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between flex-shrink-0 animate-fadeIn">
              {saveSuccess ? (
                <span className="text-emerald-600 text-sm font-bold flex items-center gap-1.5 font-display">
                  ✅ {s.saveSuccess || 'Changes stored securely!'}
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
      </div>

      {/* SECURE POPUP DIALOG WITH INTEGRATED RISK WARNER FOR MERCHANT PROFILES */}
      {showConfirmPopup && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className={`bg-white rounded-2xl border shadow-xl max-w-sm w-full overflow-hidden p-6 space-y-4 transform scale-100 transition-all ${hasCriticalChanges ? 'border-amber-300 ring-4 ring-amber-50' : 'border-slate-200'}`}>
            <div className={`flex items-center gap-3 ${hasCriticalChanges ? 'text-red-500' : 'text-amber-500'}`}>
              <span className="text-2xl">{hasCriticalChanges ? '🚨' : '⚠️'}</span>
              <h3 className="text-base font-bold text-slate-900 font-display">
                {hasCriticalChanges 
                  ? (s.criticalPopupTitle || 'WARNING: Critical Shift')
                  : (s.popupTitle || 'Confirm Settings Change')}
              </h3>
            </div>
            
            <p className="text-sm text-slate-600 font-medium leading-relaxed">
              {hasCriticalChanges 
                ? (s.criticalPopupBody || 'You are altering core financial fields or routing channels that affect settlement calculations.')
                : (s.popupBody || 'Are you sure you want to update and commit these changes?')}
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmPopup(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-colors"
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
    </div>
  );
}