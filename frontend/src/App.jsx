import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { QRCodeCanvas } from 'qrcode.react';
import { Store, Package, FolderOpen, Settings, ShoppingCart, X, CheckCircle2, AlertTriangle, Keyboard, Lock, History, Sun, Moon, Monitor } from 'lucide-react';
import { useDarkMode } from './hooks/useDarkMode';
import StockManager from './StockManager';
import SettingsManager from './SettingsManager';
import SalesHistory from './SalesHistory';
import Invoice from './Invoice';
import { translations as t } from './locales';
import UpdateChecker from './UpdateChecker';
import BackendContext from './BackendContext';

export default function App() {
  const [cart, setCart] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [amountPaidUsd, setAmountPaidUsd] = useState('');
  const [amountPaidKhr, setAmountPaidKhr] = useState('');
  const [checkoutResult, setCheckoutResult] = useState(null);
  const [invoiceData, setInvoiceData] = useState(null);
  const [view, setView] = useState('REGISTER');
  const [activeKhqr, setActiveKhqr] = useState(null);
  const [staticQrBank, setStaticQrBank] = useState('');
  const [dynamicRate, setDynamicRate] = useState(4100);
  const [showManualInput, setShowManualInput] = useState(false);
  const [locale, setLocale] = useState('km');
  const [mainCurrency, setMainCurrency] = useState('USD');
  const [storeName, setStoreName] = useState('');
  const [storeIcon, setStoreIcon] = useState('');
  const [backendStatus, setBackendStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [isDark, toggleDark] = useDarkMode();

  const [customerDisplayOpen, setCustomerDisplayOpen] = useState(false);

  const barcodeRef = useRef(null);
  const customerWindowRef = useRef(null);
  const IS_TAURI = Boolean(window.__TAURI_INTERNALS__ ?? window.__TAURI__);
  const backendPortRef = useRef(5050);
  const BACKEND_URL = IS_TAURI ? `http://localhost:${backendPortRef.current}` : (import.meta.env.PROD ? '' : 'http://localhost:5050');

  // In production Tauri builds, discover the actual port the sidecar bound to,
  // then poll until the backend is ready.
  useEffect(() => {
    if (!IS_TAURI) { setBackendStatus('ready'); return; }

    let cancelled = false;
    let healthId = null;

    async function discoverAndWait() {
      // Poll invoke until the Rust side has parsed the PORT line from sidecar stdout.
      if (import.meta.env.PROD) {
        for (let i = 0; i < 40; i++) {
          if (cancelled) return;
          try {
            const port = await invoke('get_backend_port');
            if (port) { backendPortRef.current = port; break; }
          } catch (_) {}
          await new Promise(r => setTimeout(r, 250));
        }
      }

      let attempts = 0;
      const MAX = 24; // 12 seconds total
      const url = `http://localhost:${backendPortRef.current}/api/settings`;
      healthId = setInterval(async () => {
        if (cancelled) { clearInterval(healthId); return; }
        attempts++;
        try {
          const res = await fetch(url);
          if (res.ok) { clearInterval(healthId); setBackendStatus('ready'); }
        } catch (_) {
          if (attempts >= MAX) { clearInterval(healthId); setBackendStatus('error'); }
        }
      }, 500);
    }

    discoverAndWait();
    return () => { cancelled = true; if (healthId) clearInterval(healthId); };
  }, []);

  useEffect(() => {
    focusScanner();
  }, [view]);

  useEffect(() => {
    if (view !== 'REGISTER') return;

    let keyBuffer = '';
    let lastTimestamp = Date.now();

    const handleGlobalScanStream = (e) => {
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

      const currentTimestamp = Date.now();
      if (currentTimestamp - lastTimestamp > 50) {
        keyBuffer = '';
      }
      lastTimestamp = currentTimestamp;

      if (e.key === 'Enter') {
        const cleanBarcode = keyBuffer.trim();
        if (cleanBarcode.length > 0) {
          executeDirectBarcodeLookup(cleanBarcode);
          keyBuffer = '';
        }
        return;
      }

      if (e.key.length === 1) {
        keyBuffer += e.key;
      }
    };

    const executeDirectBarcodeLookup = async (scannedBarcode) => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/products/barcode/${scannedBarcode}`);
        if (!response.ok) {
          alert(`Product with barcode "${scannedBarcode}" not registered yet!`);
          return;
        }
        const product = await response.json();

        setCart((prevCart) => {
          const existingItem = prevCart.find((item) => item.id === product.id);
          if (existingItem) {
            return prevCart.map((item) =>
              item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
            );
          }
          return [...prevCart, { ...product, quantity: 1 }];
        });

        setCheckoutResult(null);
      } catch (err) {
        console.error('Error handling direct global barcode query lookup:', err);
      }
    };

    window.addEventListener('keydown', handleGlobalScanStream);
    return () => window.removeEventListener('keydown', handleGlobalScanStream);
  }, [view, BACKEND_URL]);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/settings`)
      .then(res => res.json())
      .then(data => {
        if (data.exchange_rate) setDynamicRate(Number(data.exchange_rate));
        if (data.locale) setLocale(data.locale);
      })
      .catch(err => console.error("Could not sync app settings configuration", err));
  }, [view]);

  const toggleCustomerDisplay = async () => {
    if (customerDisplayOpen) {
      customerWindowRef.current?.close();
      customerWindowRef.current = null;
      setCustomerDisplayOpen(false);
    } else {
      const win = new WebviewWindow('customer-display', {
        url: '/?window=customer',
        title: 'Customer Display',
        width: 960,
        height: 680,
        decorations: true,
        resizable: true,
      });
      win.once('tauri://created', () => {
        setCustomerDisplayOpen(true);
      });
      win.once('tauri://error', (e) => {
        console.error('Customer display window error:', e);
        alert('Could not open customer display: ' + (e.payload || e));
        customerWindowRef.current = null;
      });
      win.once('tauri://destroyed', () => {
        setCustomerDisplayOpen(false);
        customerWindowRef.current = null;
      });
      customerWindowRef.current = win;
    }
  };

  useEffect(() => {
    if (!IS_TAURI || !customerDisplayOpen) return;

    let displayState;
    if (checkoutResult) {
      displayState = 'done';
    } else if ((paymentMethod === 'KHQR' && activeKhqr) || paymentMethod === 'STATIC_QR') {
      displayState = 'payment';
    } else if (cart.length > 0) {
      displayState = 'active';
    } else {
      displayState = 'idle';
    }

    emit('customer-display', {
      state: displayState,
      cart,
      totalUsd,
      totalKhr,
      mainCurrency,
      dynamicRate,
      storeName,
      storeIcon,
      locale,
      changeDueKhr: checkoutResult ? (checkoutResult.change_due_khr || 0) : changeDueKhr,
      paymentMethod,
      tenderedUsd: parseFloat(amountPaidUsd || 0),
      tenderedKhr: parseFloat(amountPaidKhr || 0),
      qrString: activeKhqr?.qr_string || null,
    });
  }, [cart, checkoutResult, paymentMethod, activeKhqr, customerDisplayOpen, amountPaidUsd, amountPaidKhr]);

  const focusScanner = () => {
    if (view === 'REGISTER' && barcodeRef.current) barcodeRef.current.focus();
  };

  useEffect(() => {
    let pollingInterval = null;

    if (paymentMethod === 'KHQR' && activeKhqr?.md5_hash) {
      pollingInterval = setInterval(async () => {
        try {
          const response = await fetch(`${BACKEND_URL}/api/payments/check-status/${activeKhqr.md5_hash}`);
          if (!response.ok) return;

          const data = await response.json();
          if (data.status === 'PAID') {
            clearInterval(pollingInterval);
            await autoCommitKhqrOrder(activeKhqr);
          }
        } catch (err) {
          console.error('Error running automated payment check:', err);
        }
      }, 3000);
    }

    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [activeKhqr, paymentMethod, cart]);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/settings`)
      .then(res => res.json())
      .then(data => {
        if (data.exchange_rate) setDynamicRate(Number(data.exchange_rate));
        if (data.locale) setLocale(data.locale);
        if (data.main_currency) setMainCurrency(data.main_currency);
        if (data.store_name) setStoreName(data.store_name);
        if (data.store_icon !== undefined) setStoreIcon(data.store_icon || '');
      })
      .catch(err => console.error("Could not sync app settings configuration", err));
  }, [view]);

  const handleBarcodeSubmit = async (e) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/products/barcode/${barcodeInput}`);
      if (!response.ok) {
        alert('Product not found or not registered!');
        setBarcodeInput('');
        return;
      }
      const product = await response.json();

      setCart((prevCart) => {
        const existingItem = prevCart.find((item) => item.id === product.id);
        if (existingItem) {
          return prevCart.map((item) =>
            item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
          );
        }
        return [...prevCart, { ...product, quantity: 1 }];
      });

      setBarcodeInput('');
      setCheckoutResult(null);
    } catch (err) {
      console.error('Error fetching product:', err);
    }
  };

  const fetchKHQRString = async (currentTotal) => {
    if (currentTotal <= 0) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/payments/khqr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_total_usd: currentTotal }),
      });
      const data = await response.json();
      if (response.ok) {
        setActiveKhqr(data);
      }
    } catch (err) {
      console.error("Failed to compile target KHQR string packet", err);
    }
  };

  const updateQuantity = (id, delta) => {
    setCart((prevCart) =>
      prevCart
        .map((item) => (item.id === id ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0)
    );
    setCheckoutResult(null);
    setActiveKhqr(null);
  };

  const removeItem = (id) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== id));
    setCheckoutResult(null);
    setActiveKhqr(null);
  };

  const totalUsd = cart.reduce((sum, item) => {
    const priceUsd = item.currency === 'KHR' ? item.price / dynamicRate : Number(item.price);
    return sum + (priceUsd * item.quantity);
  }, 0);
  const totalKhr = totalUsd * dynamicRate;

  const tenderedUsd = parseFloat(amountPaidUsd || 0);
  const tenderedKhr = parseFloat(amountPaidKhr || 0);
  const totalTenderedInUsd = tenderedUsd + (tenderedKhr / dynamicRate);
  const changeDueUsd = totalTenderedInUsd - totalUsd;
  const changeDueKhr = changeDueUsd > 0 ? Math.round(changeDueUsd * dynamicRate) : 0;

  const autoCommitKhqrOrder = async (khqrDetails) => {
    const cartSnapshot = [...cart];
    const payload = {
      items: cart,
      payment_method: 'KHQR',
      total_amount: totalUsd,
      amount_paid_usd: totalUsd,
      amount_paid_khr: 0,
    };

    try {
      const response = await fetch(`${BACKEND_URL}/api/orders/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (response.ok) {
        setCheckoutResult(data);
        setInvoiceData({
          order_id: data.order_id,
          items: cartSnapshot,
          totalUsd,
          totalKhr,
          paymentMethod: 'KHQR',
          amountPaidUsd: totalUsd,
          amountPaidKhr: 0,
          changeDueKhr: 0,
          timestamp: new Date().toISOString(),
        });
        setCart([]);
        setActiveKhqr(null);
        setPaymentMethod('CASH');
      }
    } catch (err) {
      console.error('Error auto-finalizing transaction process:', err);
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    const cartSnapshot = [...cart];
    const paidUsd = paymentMethod === 'CASH' ? parseFloat(amountPaidUsd || 0) : totalUsd;
    const paidKhr = paymentMethod === 'CASH' ? parseFloat(amountPaidKhr || 0) : 0;

    const payload = {
      items: cart,
      payment_method: paymentMethod,
      bank_name: paymentMethod === 'STATIC_QR' ? staticQrBank : null,
      total_amount: totalUsd,
      amount_paid_usd: paidUsd,
      amount_paid_khr: paidKhr,
    };

    try {
      const response = await fetch(`${BACKEND_URL}/api/orders/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (response.ok) {
        setCheckoutResult(data);
        setInvoiceData({
          order_id: data.order_id,
          items: cartSnapshot,
          totalUsd,
          totalKhr,
          paymentMethod,
          bankName: paymentMethod === 'STATIC_QR' ? staticQrBank : null,
          amountPaidUsd: paidUsd,
          amountPaidKhr: paidKhr,
          changeDueKhr: data.change_due_khr || 0,
          timestamp: new Date().toISOString(),
        });
        setCart([]);
        setAmountPaidUsd('');
        setAmountPaidKhr('');
        setActiveKhqr(null);
        setStaticQrBank('');
      } else {
        alert(`Checkout Failed: ${data.error}`);
      }
    } catch (err) {
      console.error('Error checking out:', err);
    }
  };

  if (backendStatus === 'loading') {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:'16px', fontFamily:'sans-serif' }}>
        <div style={{ width:'40px', height:'40px', border:'4px solid #ccc', borderTopColor:'#555', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
        <p style={{ color:'#555', margin:0 }}>Starting backend…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (backendStatus === 'error') {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:'12px', fontFamily:'sans-serif' }}>
        <p style={{ color:'#c00', fontSize:'18px', margin:0, display:'flex', alignItems:'center', gap:'8px' }}><AlertTriangle size={18} />Backend failed to start</p>
        <p style={{ color:'#555', margin:0 }}>The database server did not respond after 12 seconds.</p>
        <p style={{ color:'#888', fontSize:'13px', margin:0 }}>Try restarting the app. If it keeps failing, reinstall.</p>
      </div>
    );
  }

  if (view === 'STOCK') {
    return (
      <BackendContext.Provider value={BACKEND_URL}>
        <StockManager
          onBackToRegister={() => setView('REGISTER')}
          currentLocale={locale}
          mainCurrency={mainCurrency}
          dynamicRate={dynamicRate}
        />
      </BackendContext.Provider>
    );
  }

  if (view === 'HISTORY') {
    return (
      <BackendContext.Provider value={BACKEND_URL}>
        <SalesHistory
          onBackToRegister={() => setView('REGISTER')}
          currentLocale={locale}
          dynamicRate={dynamicRate}
          mainCurrency={mainCurrency}
        />
      </BackendContext.Provider>
    );
  }

  if (view === 'SETTINGS') {
    return (
      <BackendContext.Provider value={BACKEND_URL}>
        <SettingsManager
          onBackToRegister={() => setView('REGISTER')}
          currentLocale={locale}
          onLocaleChange={setLocale}
          mainCurrency={mainCurrency}
          onCurrencyChange={setMainCurrency}
        />
      </BackendContext.Provider>
    );
  }

  return (
    <>
    <div className="h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-900 flex flex-col font-sans text-slate-900 dark:text-white antialiased">
      {/* Structural Header Grid */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-3.5 flex justify-between items-center shadow-xs flex-shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 flex items-center justify-center text-4xl flex-shrink-0">
            {storeIcon
              ? <img src={storeIcon} alt="store" className="w-10 h-10 rounded-xl object-cover" />
              : <Store size={20} className="text-slate-400 dark:text-slate-500" />}
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight font-display">{storeName || t[locale].shopName}</h1>
            <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 tracking-wider uppercase">{t[locale].register}</p>
          </div>
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-600 ml-2"></div>
          <button
            onClick={() => setView('STOCK')}
            className="px-3.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 border border-transparent hover:border-slate-200 dark:hover:border-slate-600 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 transition-all flex items-center gap-1.5"
          >
            <Package size={14} /> {t[locale].manageInventory}
          </button>
          <button
            onClick={() => setView('HISTORY')}
            className="px-3.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 border border-transparent hover:border-slate-200 dark:hover:border-slate-600 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 transition-all flex items-center gap-1.5"
          >
            <History size={14} /> {t[locale].salesHistory.title}
          </button>
          <button
            onClick={() => setView('SETTINGS')}
            className="px-3.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 border border-transparent hover:border-slate-200 dark:hover:border-slate-600 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 transition-all flex items-center gap-1.5"
          >
            <Settings size={14} /> {t[locale].settings}
          </button>
        </div>
        <div className="flex items-center gap-2">
          {IS_TAURI && (
            <button
              onClick={toggleCustomerDisplay}
              className={`p-2 rounded-xl transition-colors ${customerDisplayOpen ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400'}`}
              title={customerDisplayOpen ? t[locale].customerDisplay.closeBtn : t[locale].customerDisplay.openBtn}
            >
              <Monitor size={16} />
            </button>
          )}
          <button
            onClick={toggleDark}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <UpdateChecker />
          <div className="bg-slate-50 dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300">
            {t[locale].exchangeRate}: <span className="font-bold text-slate-900 dark:text-white ml-1">$1 = {dynamicRate.toLocaleString()} ៛</span>
          </div>
        </div>
      </header>

      {/* Main Container Dashboard split layout */}
      <div className="flex-1 flex overflow-hidden w-full">
        {/* Left Workspace Panel: Basket stream and actions */}
        <div className="flex-1 flex flex-col p-5 overflow-hidden gap-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 p-4 rounded-2xl shadow-xs text-indigo-900 dark:text-indigo-200 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300 tracking-wide uppercase">{t[locale].bgListenerActive}</p>
              </div>
              <button
                onClick={() => {
                  setShowManualInput(!showManualInput);
                  setBarcodeInput('');
                }}
                className={`text-xs font-bold px-3 py-2 rounded-xl transition-all flex items-center gap-1 ${showManualInput ? 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200' : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40'}`}
              >
                {showManualInput
                  ? <><Lock size={13} /> {t[locale].closeManual}</>
                  : <><Keyboard size={13} /> {t[locale].typeManual}</>}
              </button>
            </div>

            {showManualInput && (
              <form onSubmit={handleBarcodeSubmit} className="flex gap-2 mt-3 animate-fadeIn">
                <input
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder={t[locale].placeholderManual}
                  className="flex-1 h-11 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 dark:focus:ring-indigo-900/30"
                  autoFocus
                />
                <button
                  type="submit"
                  className="h-11 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-colors shadow-xs"
                >
                  {t[locale].addItem}
                </button>
              </form>
            )}
          </div>

          {/* Master Item Basket View */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex-1 flex flex-col overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center flex-shrink-0">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight font-display">{t[locale].currentBasket}</h2>
              <span className="text-xs bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 font-bold px-3 py-1 rounded-full">
                {cart.reduce((a, b) => a + b.quantity, 0)} {t[locale].itemsCount}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 content-start">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 gap-3 py-12">
                  <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-2xl flex items-center justify-center border border-slate-100 dark:border-slate-700/50 text-slate-300 dark:text-slate-600"><ShoppingCart size={28} /></div>
                  <p className="text-sm font-semibold text-slate-400 dark:text-slate-500 font-display">{t[locale].basketEmpty}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3.5 bg-slate-50/60 dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl border border-slate-100/80 dark:border-slate-700/30 transition-colors">
                      <div className="flex-1 min-w-0 pr-4">
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">{item.name}</h3>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 tracking-wider mt-0.5">#{item.barcode}</p>
                      </div>
                      <div className="flex items-center gap-5">
                        <div className="flex items-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 rounded-xl p-0.5 shadow-2xs">
                          <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 flex items-center justify-center font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">&minus;</button>
                          <span className="w-9 text-center font-bold text-sm text-slate-800 dark:text-slate-100">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 flex items-center justify-center font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">+</button>
                        </div>
                        <div className="text-right w-24">
                          <p className="font-bold text-sm text-slate-900 dark:text-white">
                          {item.currency === 'KHR'
                            ? `${(item.price * item.quantity).toLocaleString()} ៛`
                            : `$${(Number(item.price) * item.quantity).toFixed(2)}`}
                        </p>
                        </div>
                        <button onClick={() => removeItem(item.id)} className="text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 w-8 h-8 rounded-lg transition-all flex items-center justify-center"><X size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Checkout Ledger Panel */}
        <div className="w-96 bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 shadow-xl p-5 flex flex-col justify-between overflow-y-auto flex-shrink-0">
          <div className="space-y-5">
            <h2 className="text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase font-display">{t[locale].paymentStatement}</h2>

            <div className="bg-slate-900 dark:bg-slate-950 text-white rounded-2xl p-5 relative overflow-hidden shadow-md shadow-slate-900/10">
              <div className="space-y-3 relative z-10">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-medium text-slate-400 font-display">
                    {mainCurrency === 'USD' ? t[locale].totalUsd : t[locale].totalKhr}
                  </span>
                  <span className="text-3xl font-black tracking-tight">
                    {mainCurrency === 'USD' ? `$${totalUsd.toFixed(2)}` : `${Math.round(totalKhr).toLocaleString()} ៛`}
                  </span>
                </div>
                <div className="border-t border-slate-800 dark:border-slate-700/80 pt-2.5 flex justify-between items-baseline">
                  <span className="text-xs font-medium text-slate-400 font-display">
                    {mainCurrency === 'USD' ? t[locale].totalKhr : t[locale].totalUsd}
                  </span>
                  <span className="text-base font-bold text-emerald-400">
                    {mainCurrency === 'USD' ? `${Math.round(totalKhr).toLocaleString()} ៛` : `$${totalUsd.toFixed(2)}`}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase mb-2 font-display">{t[locale].settlementType}</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => { setPaymentMethod('CASH'); setCheckoutResult(null); setActiveKhqr(null); }}
                  className={`py-3 px-2 rounded-xl border font-bold text-xs transition-all flex items-center justify-center gap-1 ${paymentMethod === 'CASH' ? 'bg-slate-900 text-white border-slate-900 shadow-xs' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                  {t[locale].cash}
                </button>
                <button
                  onClick={() => { setPaymentMethod('KHQR'); setCheckoutResult(null); fetchKHQRString(totalUsd); }}
                  className={`py-3 px-2 rounded-xl border font-bold text-xs transition-all flex items-center justify-center gap-1 ${paymentMethod === 'KHQR' ? 'bg-rose-600 text-white border-rose-600 shadow-xs' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                  {t[locale].khqr}
                </button>
                <button
                  onClick={() => { setPaymentMethod('STATIC_QR'); setCheckoutResult(null); setActiveKhqr(null); setStaticQrBank(''); }}
                  className={`py-3 px-2 rounded-xl border font-bold text-xs transition-all flex items-center justify-center gap-1 ${paymentMethod === 'STATIC_QR' ? 'bg-amber-500 text-white border-amber-500 shadow-xs' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                  {t[locale].staticQr}
                </button>
              </div>
            </div>

            {paymentMethod === 'CASH' ? (
              <div className="space-y-4">
                <div className="space-y-3 bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700/40">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide font-display">{t[locale].tenderedKhr}</label>
                    <input
                      type="number"
                      value={amountPaidKhr}
                      onChange={(e) => { setAmountPaidKhr(e.target.value); setCheckoutResult(null); }}
                      className="w-full mt-1.5 h-10 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-100 text-sm focus:ring-2 focus:ring-indigo-50 dark:focus:ring-indigo-900/30 focus:outline-hidden focus:border-indigo-500"
                      placeholder="0"
                      step="100"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide font-display">{t[locale].tenderedUsd}</label>
                    <input
                      type="number"
                      value={amountPaidUsd}
                      onChange={(e) => { setAmountPaidUsd(e.target.value); setCheckoutResult(null); }}
                      className="w-full mt-1.5 h-10 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-100 text-sm focus:ring-2 focus:ring-indigo-50 dark:focus:ring-indigo-900/30 focus:outline-hidden focus:border-indigo-500"
                      placeholder="0.00"
                      step="0.01"
                      min="0.00"
                    />
                  </div>
                </div>

                {totalTenderedInUsd > 0 && (
                  <div className={`p-4 rounded-2xl border transition-all ${changeDueUsd >= 0 ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800' : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'}`}>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide font-display">
                        {changeDueUsd >= 0 ? t[locale].changeDue : t[locale].shortage}
                      </span>
                      <span className={`text-lg font-black ${changeDueUsd >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {mainCurrency === 'USD'
                          ? changeDueUsd >= 0 ? `$${changeDueUsd.toFixed(2)}` : `$${Math.abs(changeDueUsd).toFixed(2)}`
                          : changeDueUsd >= 0 ? `${Math.round(changeDueUsd * dynamicRate).toLocaleString()} ៛` : `${Math.round(Math.abs(changeDueUsd) * dynamicRate).toLocaleString()} ៛`
                        }
                      </span>
                    </div>
                    <p className="text-[10px] font-bold text-right mt-0.5 text-slate-400 dark:text-slate-500">
                      {mainCurrency === 'USD'
                        ? `${Math.round(changeDueUsd * dynamicRate).toLocaleString()} ៛`
                        : `$${changeDueUsd.toFixed(2)} USD`
                      }
                    </p>
                  </div>
                )}
              </div>
            ) : paymentMethod === 'STATIC_QR' ? (
              <div className="space-y-3 bg-amber-50/30 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900 p-4 rounded-2xl">
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide font-display">{t[locale].staticQrPrompt}</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {['ABA', 'ACLEDA', 'Wing', 'KB Prasac', 'Sathapana', 'Canadia', 'Maybank', 'CHIP Mong', 'Hattha', 'Prince', 'Other'].map(bank => (
                    <button
                      key={bank}
                      onClick={() => setStaticQrBank(b => b === bank ? '' : bank)}
                      className={`py-2 px-1 rounded-xl border font-bold text-[11px] transition-all ${staticQrBank === bank ? 'bg-amber-500 text-white border-amber-500' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:border-amber-200 dark:hover:border-amber-800'}`}
                    >
                      {bank}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">{t[locale].staticQrNote}</p>
                <button
                  onClick={handleCheckout}
                  disabled={cart.length === 0 || !staticQrBank}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition-all font-display shadow-xs ${cart.length === 0 || !staticQrBank ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed' : 'bg-amber-500 text-white hover:bg-amber-600 active:scale-[0.99]'}`}
                >
                  {staticQrBank ? t[locale].confirmReceived : `${t[locale].selectBank}...`}
                </button>
              </div>
            ) : (
              <div className="space-y-4 bg-rose-50/30 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900 p-5 rounded-2xl flex flex-col items-center">
                {activeKhqr ? (
                  <>
                    <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl shadow-xs border border-rose-100 dark:border-rose-900">
                      <QRCodeCanvas value={activeKhqr.qr_string} size={160} level={"M"} includeMargin={true} />
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-xs text-slate-800 dark:text-slate-100 font-display">{t[locale].scanToPay}</p>
                      <p className="text-[10px] text-rose-500 font-bold mt-0.5">{t[locale].ref}: {activeKhqr.md5_hash.substring(0, 8).toUpperCase()}</p>
                      <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-2 font-display animate-pulse">{t[locale].waitingPayment}</p>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-bold font-display animate-pulse">{t[locale].assemblingPacket}</p>
                )}
              </div>
            )}
          </div>

          <div className="mt-5 space-y-3 flex-shrink-0">
            {checkoutResult && (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 p-3.5 rounded-xl flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-xs text-emerald-900 dark:text-emerald-200 font-display">{t[locale].orderSaved}</p>
                  {checkoutResult.change_due_khr > 0 && (
                    <p className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{checkoutResult.change_due_khr.toLocaleString()} ៛</p>
                  )}
                </div>
              </div>
            )}

            {paymentMethod === 'CASH' && (
              <button
                onClick={handleCheckout}
                disabled={cart.length === 0 || totalTenderedInUsd < totalUsd}
                className={`w-full h-12 rounded-xl font-bold transition-all text-sm font-display shadow-xs ${cart.length === 0 || totalTenderedInUsd < totalUsd ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed' : 'bg-indigo-600 text-white cursor-pointer hover:bg-indigo-700 active:scale-[0.99]'}`}
              >
                {t[locale].finalizeOrder}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>

      {invoiceData && (
        <Invoice
          invoiceData={invoiceData}
          locale={locale}
          onClose={() => setInvoiceData(null)}
        />
      )}
    </>
  );
}
