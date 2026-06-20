import React, { useState, useEffect } from 'react';
// Import the centralized translations dictionary map
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
  const [saveSuccess, setSaveSuccess] = useState(false);
  const BACKEND_URL = 'http://localhost:5050';

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/settings`);
      if (response.ok) {
        const data = await response.json();
        setSettings(prev => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.error('Failed to load store settings:', err);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${BACKEND_URL}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        // Sync parent React application state contexts down immediately upon completion
        onLocaleChange(settings.locale);
        onCurrencyChange(settings.main_currency); 
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert(currentLocale === 'km' ? 'ការរក្សាទុកការកំណត់បានបរាជ័យ។' : 'Failed to save settings configurations.');
      }
    } catch (err) {
      console.error('Error pushing updated options layout:', err);
    }
  };

  // Extract variables safely from your locales structure
  const currentTranslations = t[currentLocale] || {};
  const s = currentTranslations.settingsPage || {};

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 antialiased">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4 shadow-xs">
        <button 
          onClick={onBackToRegister}
          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-semibold transition-colors text-slate-600 font-display"
        >
          ⬅ {currentTranslations.register || 'Register'}
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight font-display">
            {currentTranslations.settingsTitle || currentTranslations.settings || 'Settings'}
          </h1>
          <p className="text-xs font-bold text-indigo-600 tracking-wider uppercase">
            {s.auditRoom || 'Terminal Configuration'}
          </p>
        </div>
      </header>

      <div className="flex-1 p-6 max-w-2xl mx-auto w-full">
        <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden p-6 space-y-6">
          
          {/* Section: Language Selection */}
          <div>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 mb-4 font-display">
              🌐 Language / ភាសា
            </h2>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide font-display">
              {currentLocale === 'km' ? 'ភាសាបង្ហាញរបស់ម៉ាស៊ីន' : 'Terminal Display Language'}
            </label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <button
                type="button"
                onClick={() => setSettings({ ...settings, locale: 'km' })}
                className={`py-3 px-4 rounded-xl border font-bold text-sm transition-all flex items-center justify-center gap-2 font-display ${
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
                className={`py-3 px-4 rounded-xl border font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                  settings.locale === 'en' 
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                🇺🇸 English (EN)
              </button>
            </div>
          </div>

          {/* Section for primary Base Currency configuration */}
          <div>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 mb-4 font-display">
              💱 {s.currencySetting || 'Base Currency Configuration'}
            </h2>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide font-display">
              {currentLocale === 'km' ? 'ជ្រើសរើសរូបិយប័ណ្ណចម្បងសម្រាប់ទូទាត់ប្រាក់' : 'Select Primary Transactional Currency'}
            </label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <button
                type="button"
                onClick={() => setSettings({ ...settings, main_currency: 'USD' })}
                className={`py-3 px-4 rounded-xl border font-bold text-sm transition-all flex items-center justify-center gap-2 font-display ${
                  settings.main_currency === 'USD' 
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                💵 {s.mainCurrencyUsd || 'US Dollar (USD)'}
              </button>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, main_currency: 'KHR' })}
                className={`py-3 px-4 rounded-xl border font-bold text-sm transition-all flex items-center justify-center gap-2 font-display ${
                  settings.main_currency === 'KHR' 
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                🇰🇭 {s.mainCurrencyKhr || 'Khmer Riel (KHR)'}
              </button>
            </div>
          </div>

          {/* Section: Financial parameters */}
          <div>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 mb-4 font-display">
              💰 {currentLocale === 'km' ? 'ហិរញ្ញវត្ថុ & អត្រាប្តូរប្រាក់' : 'Financials & Rates'}
            </h2>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide font-display">
                {(currentTranslations.exchangeRate || 'Exchange Rate')} (1 USD = ? KHR)
              </label>
              <input 
                type="number"
                value={settings.exchange_rate}
                onChange={(e) => setSettings({...settings, exchange_rate: e.target.value})}
                className="w-full mt-1.5 p-2.5 border border-slate-200 bg-slate-50 rounded-lg text-sm font-bold tracking-wide font-mono focus:outline-none focus:border-indigo-500"
                placeholder="4100"
              />
              <p className="text-xs text-slate-400 mt-1 font-display">
                {currentLocale === 'km' 
                  ? 'ប្រើប្រាស់សម្រាប់គណនាការប្តូរប្រាក់រៀលស្វ័យប្រវត្តិនៅពេលទូទាត់ប្រាក់ និងគណនាប្រាក់អាប់ជូនអតិថិជន។' 
                  : 'Used to automatically calculate Riel checkout conversions and changes at the physical cash register drawer.'}
              </p>
            </div>
          </div>

          {/* Section: Bakong Credentials */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 mb-2 font-display">
              📱 Individual KHQR Profile
            </h2>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide font-display">
                {currentLocale === 'km' ? 'អត្តសញ្ញាណគណនីបាកុង (Bakong Account ID)' : 'Bakong Individual Account ID'}
              </label>
              <input 
                type="text"
                value={settings.bakong_account_id}
                onChange={(e) => setSettings({...settings, bakong_account_id: e.target.value})}
                className="w-full mt-1.5 p-2.5 border border-slate-200 bg-slate-50 rounded-lg text-sm font-mono text-indigo-600 focus:outline-none focus:border-indigo-500"
                placeholder="store_account@abaa"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide font-display">
                  {currentLocale === 'km' ? 'ឈ្មោះហាងបង្ហាញ' : 'Display Shop Name'}
                </label>
                <input 
                  type="text"
                  value={settings.bakong_merchant_name}
                  onChange={(e) => setSettings({...settings, bakong_merchant_name: e.target.value})}
                  className="w-full mt-1.5 p-2.5 border border-slate-200 bg-slate-50 rounded-lg text-sm font-medium font-display focus:outline-none focus:border-indigo-500"
                  placeholder="Baby Mart"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide font-display">
                  {currentLocale === 'km' ? 'ទីក្រុងដំណើរការហាង' : 'Store Operating City'}
                </label>
                <input 
                  type="text"
                  value={settings.bakong_merchant_city}
                  onChange={(e) => setSettings({...settings, bakong_merchant_city: e.target.value})}
                  className="w-full mt-1.5 p-2.5 border border-slate-200 bg-slate-50 rounded-lg text-sm font-medium font-display focus:outline-none focus:border-indigo-500"
                  placeholder="Phnom Penh"
                />
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            {saveSuccess ? (
              <span className="text-emerald-600 text-sm font-bold flex items-center gap-1.5 font-display">
                ✅ {currentLocale === 'km' ? 'រក្សាទុកការផ្លាស់ប្តូរដោយជោគជ័យ!' : 'Changes stored securely!'}
              </span>
            ) : <div />}
            
            <button
              type="submit"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-xs transition-colors font-display"
            >
              {currentLocale === 'km' ? 'រក្សាទុកការកំណត់' : 'Commit Configuration Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}