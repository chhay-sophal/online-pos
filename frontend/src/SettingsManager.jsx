import React, { useState, useEffect } from 'react';

export default function SettingsManager({ onBackToRegister }) {
  const [settings, setSettings] = useState({
    exchange_rate: '4100',
    bakong_account_id: '',
    bakong_merchant_name: '',
    bakong_merchant_city: ''
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
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert('Failed to save settings configurations.');
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
          ⬅️ Register Terminal
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">System Settings</h1>
          <p className="text-xs font-semibold text-indigo-600 tracking-wider uppercase">Terminal Configuration</p>
        </div>
      </header>

      <div className="flex-1 p-6 max-w-2xl mx-auto w-full">
        <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden p-6 space-y-6">
          
          {/* Section 1: Financial parameters */}
          <div>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 mb-4">💰 Financials & Rates</h2>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Market Exchange Rate (1 USD = ? KHR)</label>
              <input 
                type="number"
                value={settings.exchange_rate}
                onChange={(e) => setSettings({...settings, exchange_rate: e.target.value})}
                className="w-full mt-1.5 p-2.5 border border-slate-200 bg-slate-50 rounded-lg text-sm font-bold tracking-wide"
                placeholder="4100"
              />
              <p className="text-xs text-slate-400 mt-1">Used to automatically calculate Riel checkout conversions and changes at the physical cash register drawer.</p>
            </div>
          </div>

          {/* Section 2: Bakong Credentials */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 mb-2">📱 Individual KHQR Profile</h2>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Bakong Individual Account ID</label>
              <input 
                type="text"
                value={settings.bakong_account_id}
                onChange={(e) => setSettings({...settings, bakong_account_id: e.target.value})}
                className="w-full mt-1.5 p-2.5 border border-slate-200 bg-slate-50 rounded-lg text-sm font-mono text-indigo-600"
                placeholder="e.g. chhay_sophal@abaa"
              />
              <p className="text-xs text-slate-400 mt-1">Your official personal or individual merchant username address generated inside your mobile banking application.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Display Shop Name</label>
                <input 
                  type="text"
                  value={settings.bakong_merchant_name}
                  onChange={(e) => setSettings({...settings, bakong_merchant_name: e.target.value})}
                  className="w-full mt-1.5 p-2.5 border border-slate-200 bg-slate-50 rounded-lg text-sm font-medium"
                  placeholder="Baby Mart"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Store Operating City</label>
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
                ✅ Changes stored securely!
              </span>
            ) : <div />}
            
            <button
              type="submit"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-xs transition-colors"
            >
              Commit Configuration Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}