import React, { useState, useEffect } from 'react';

export default function SettingsManager({ onBackToRegister, currentLocale, onLocaleChange }) {
  const [settings, setSettings] = useState({
    exchange_rate: '4100',
    bakong_account_id: '',
    bakong_merchant_name: '',
    bakong_merchant_city: '',
    locale: 'km'
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
        // Update top-level application state instantly
        onLocaleChange(settings.locale);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert(settings.locale === 'km' ? 'ការរក្សាទុកការកំណត់បានបរាជ័យ។' : 'Failed to save settings configurations.');
      }
    } catch (err) {
      console.error('Error pushing updated options layout:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 antialiased">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4 shadow-xs">
        <button 
          onClick={onBackToRegister}
          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-semibold transition-colors text-slate-600"
        >
          ⬅️ {currentLocale === 'km' ? 'បញ្ជរលក់ទំនិញ' : 'Register Terminal'}
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {currentLocale === 'km' ? 'ការកំណត់ប្រព័ន្ធ' : 'System Settings'}
          </h1>
          <p className="text-xs font-semibold text-indigo-600 tracking-wider uppercase">
            {currentLocale === 'km' ? 'ការកំណត់ទម្រង់ម៉ាស៊ីន' : 'Terminal Configuration'}
          </p>
        </div>
      </header>

      <div className="flex-1 p-6 max-w-2xl mx-auto w-full">
        <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden p-6 space-y-6">
          
          {/* Section: Language Selection */}
          <div>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 mb-4">
              🌐 Language / ភាសា
            </h2>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
              {settings.locale === 'km' ? 'ភាសាបង្ហាញរបស់ម៉ាស៊ីន' : 'Terminal Display Language'}
            </label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <button
                type="button"
                onClick={() => setSettings({ ...settings, locale: 'km' })}
                className={`py-3 px-4 rounded-xl border font-bold text-sm transition-all flex items-center justify-center gap-2 ${
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

          {/* Section 1: Financial parameters */}
          <div>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 mb-4">
              💰 {settings.locale === 'km' ? 'ហិរញ្ញវត្ថុ & អត្រាប្តូរប្រាក់' : 'Financials & Rates'}
            </h2>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
                {settings.locale === 'km' ? 'អត្រាប្តូរប្រាក់ទីផ្សារ (1 USD = ? KHR)' : 'Market Exchange Rate (1 USD = ? KHR)'}
              </label>
              <input 
                type="number"
                value={settings.exchange_rate}
                onChange={(e) => setSettings({...settings, exchange_rate: e.target.value})}
                className="w-full mt-1.5 p-2.5 border border-slate-200 bg-slate-50 rounded-lg text-sm font-bold tracking-wide"
                placeholder="4100"
              />
              <p className="text-xs text-slate-400 mt-1">
                {settings.locale === 'km' 
                  ? 'ប្រើប្រាស់សម្រាប់គណនាការប្តូរប្រាក់រៀលស្វ័យប្រវត្តិនៅពេលទូទាត់ប្រាក់ និងគណនាប្រាក់អាប់ជូនអតិថិជន។' 
                  : 'Used to automatically calculate Riel checkout conversions and changes at the physical cash register drawer.'}
              </p>
            </div>
          </div>

          {/* Section 2: Bakong Credentials */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 mb-2">
              📱 {settings.locale === 'km' ? 'គណនី KHQR ផ្ទាល់ខ្លួន' : 'Individual KHQR Profile'}
            </h2>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
                {settings.locale === 'km' ? 'អត្តសញ្ញាណគណនីបាកុង (Bakong Account ID)' : 'Bakong Individual Account ID'}
              </label>
              <input 
                type="text"
                value={settings.bakong_account_id}
                onChange={(e) => setSettings({...settings, bakong_account_id: e.target.value})}
                className="w-full mt-1.5 p-2.5 border border-slate-200 bg-slate-50 rounded-lg text-sm font-mono text-indigo-600"
                placeholder="e.g. store_account@abaa"
              />
              <p className="text-xs text-slate-400 mt-1">
                {settings.locale === 'km' 
                  ? 'អាសយដ្ឋានគណនីបាកុងផ្លូវការរបស់អ្នកដែលបានបង្កើតឡើងនៅក្នុងកម្មវិធីធនាគារចល័តរបស់អ្នក។' 
                  : 'Your official personal or individual merchant username address generated inside your mobile banking application.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
                  {settings.locale === 'km' ? 'ឈ្មោះហាងបង្ហាញ' : 'Display Shop Name'}
                </label>
                <input 
                  type="text"
                  value={settings.bakong_merchant_name}
                  onChange={(e) => setSettings({...settings, bakong_merchant_name: e.target.value})}
                  className="w-full mt-1.5 p-2.5 border border-slate-200 bg-slate-50 rounded-lg text-sm font-medium"
                  placeholder="Baby Mart"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
                  {settings.locale === 'km' ? 'ទីក្រុងដំណើរការហាង' : 'Store Operating City'}
                </label>
                <input 
                  type="text"
                  value={settings.bakong_merchant_city}
                  onChange={(e) => setSettings({...settings, bakong_merchant_city: e.target.value})}
                  className="w-full mt-1.5 p-2.5 border border-slate-200 bg-slate-50 rounded-lg text-sm font-medium"
                  placeholder="Phnom Penh"
                />
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            {saveSuccess ? (
              <span className="text-emerald-600 text-sm font-bold flex items-center gap-1.5">
                {settings.locale === 'km' ? '✅ រក្សាទុកការផ្លាស់ប្តូរដោយជោគជ័យ!' : '✅ Changes stored securely!'}
              </span>
            ) : <div />}
            
            <button
              type="submit"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-xs transition-colors"
            >
              {settings.locale === 'km' ? 'រក្សាទុកការកំណត់' : 'Commit Configuration Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}