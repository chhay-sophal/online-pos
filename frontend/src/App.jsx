import React, { useState, useEffect, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import StockManager from './StockManager';
import SettingsManager from './SettingsManager';
import SalesHistory from './SalesHistory';
import Invoice from './Invoice';
import { translations as t } from './locales';

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
  const [dynamicRate, setDynamicRate] = useState(4100);
  const [showManualInput, setShowManualInput] = useState(false);
  const [locale, setLocale] = useState('km'); 
  const [mainCurrency, setMainCurrency] = useState('USD');
  
  const barcodeRef = useRef(null);
  const BACKEND_URL = 'http://localhost:5050';

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
        if (data.main_currency) setMainCurrency(data.main_currency); // Add this line
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
          amountPaidUsd: paidUsd,
          amountPaidKhr: paidKhr,
          changeDueKhr: data.change_due_khr || 0,
          timestamp: new Date().toISOString(),
        });
        setCart([]);
        setAmountPaidUsd('');
        setAmountPaidKhr('');
        setActiveKhqr(null);
      } else {
        alert(`Checkout Failed: ${data.error}`);
      }
    } catch (err) {
      console.error('Error checking out:', err);
    }
  };

  if (view === 'STOCK') {
    return (
      <StockManager
        onBackToRegister={() => setView('REGISTER')}
        currentLocale={locale}
        mainCurrency={mainCurrency}
        dynamicRate={dynamicRate}
      />
    );
  }

  if (view === 'HISTORY') {
    return (
      <SalesHistory
        onBackToRegister={() => setView('REGISTER')}
        currentLocale={locale}
        dynamicRate={dynamicRate}
        mainCurrency={mainCurrency}
      />
    );
  }

  if (view === 'SETTINGS') {
    return (
      <SettingsManager 
        onBackToRegister={() => setView('REGISTER')} 
        currentLocale={locale}
        onLocaleChange={setLocale}
        mainCurrency={mainCurrency}
        onCurrencyChange={setMainCurrency}
        backendUrl={BACKEND_URL}
      />
    );
  }

  return (
    <>
    <div className="h-screen w-screen overflow-hidden bg-slate-50 flex flex-col font-sans text-slate-900 antialiased">
      {/* Structural Header Grid */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex justify-between items-center shadow-xs flex-shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 flex items-center justify-center text-4xl">🏬</div>
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight font-display">{t[locale].shopName}</h1>
            <p className="text-[11px] font-bold text-indigo-600 tracking-wider uppercase">{t[locale].register}</p>
          </div>
          <div className="h-6 w-px bg-slate-200 ml-2"></div>
          <button
            onClick={() => setView('STOCK')}
            className="px-3.5 py-1.5 hover:bg-slate-100 border border-transparent hover:border-slate-200 rounded-xl text-xs font-bold text-slate-600 transition-all flex items-center gap-1.5"
          >
            📦 {t[locale].manageInventory}
          </button>
          <button
            onClick={() => setView('HISTORY')}
            className="px-3.5 py-1.5 hover:bg-slate-100 border border-transparent hover:border-slate-200 rounded-xl text-xs font-bold text-slate-600 transition-all flex items-center gap-1.5"
          >
            🗂️ {t[locale].salesHistory.title}
          </button>
          <button
            onClick={() => setView('SETTINGS')}
            className="px-3.5 py-1.5 hover:bg-slate-100 border border-transparent hover:border-slate-200 rounded-xl text-xs font-bold text-slate-600 transition-all flex items-center gap-1.5"
          >
            ⚙️ {t[locale].settings}
          </button>
        </div>
        <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600">
          {t[locale].exchangeRate}: <span className="font-bold text-slate-900 font-mono ml-1">$1 = {dynamicRate.toLocaleString()} ៛</span>
        </div>
      </header>

      {/* Main Container Dashboard split layout */}
      <div className="flex-1 flex overflow-hidden w-full">
        {/* Left Workspace Panel: Basket stream and actions */}
        <div className="flex-1 flex flex-col p-5 overflow-hidden gap-4">
          <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs text-indigo-900 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <p className="text-xs font-bold text-slate-600 tracking-wide uppercase">{t[locale].bgListenerActive}</p>
              </div>
              <button
                onClick={() => {
                  setShowManualInput(!showManualInput);
                  setBarcodeInput('');
                }}
                className={`text-xs font-bold px-3 py-2 rounded-xl transition-all ${showManualInput ? 'bg-slate-100 text-slate-700' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
              >
                {showManualInput ? t[locale].closeManual : t[locale].typeManual}
              </button>
            </div>

            {showManualInput && (
              <form onSubmit={handleBarcodeSubmit} className="flex gap-2 mt-3 animate-fadeIn">
                <input
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder={t[locale].placeholderManual}
                  className="flex-1 h-11 px-4 bg-slate-50 border border-slate-200 focus:bg-white text-slate-800 rounded-xl text-sm font-mono focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50"
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
          <div className="bg-white rounded-2xl border border-slate-200/80 flex-1 flex flex-col overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center flex-shrink-0">
              <h2 className="text-sm font-bold text-slate-800 tracking-tight font-display">{t[locale].currentBasket}</h2>
              <span className="text-xs bg-slate-200/80 text-slate-700 font-bold px-3 py-1 rounded-full font-mono">
                {cart.reduce((a, b) => a + b.quantity, 0)} {t[locale].itemsCount}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 content-start">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 py-12">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-2xl border border-slate-100">🛒</div>
                  <p className="text-sm font-semibold text-slate-400 font-display">{t[locale].basketEmpty}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3.5 bg-slate-50/60 hover:bg-slate-50 rounded-xl border border-slate-100/80 transition-colors">
                      <div className="flex-1 min-w-0 pr-4">
                        <h3 className="font-bold text-sm text-slate-900 truncate">{item.name}</h3>
                        <p className="text-[11px] text-slate-400 font-mono tracking-wider mt-0.5">#{item.barcode}</p>
                      </div>
                      <div className="flex items-center gap-5">
                        <div className="flex items-center border border-slate-200 bg-white rounded-xl p-0.5 shadow-2xs">
                          <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 flex items-center justify-center font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">&minus;</button>
                          <span className="w-9 text-center font-bold text-sm text-slate-800 font-mono">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 flex items-center justify-center font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">+</button>
                        </div>
                        <div className="text-right w-24">
                          <p className="font-bold text-sm text-slate-900 font-mono">
                          {item.currency === 'KHR'
                            ? `${(item.price * item.quantity).toLocaleString()} ៛`
                            : `$${(Number(item.price) * item.quantity).toFixed(2)}`}
                        </p>
                        </div>
                        <button onClick={() => removeItem(item.id)} className="text-slate-300 hover:text-rose-500 hover:bg-rose-50 w-8 h-8 rounded-lg transition-all text-xs flex items-center justify-center">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Checkout Ledger Panel */}
        <div className="w-96 bg-white border-l border-slate-200 shadow-xl p-5 flex flex-col justify-between overflow-y-auto flex-shrink-0">
          <div className="space-y-5">
            <h2 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase font-display">{t[locale].paymentStatement}</h2>
            
            <div className="bg-slate-900 text-white rounded-2xl p-5 relative overflow-hidden shadow-md shadow-slate-900/10">
              <div className="space-y-3 relative z-10">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-medium text-slate-400 font-display">
                    {mainCurrency === 'USD' ? t[locale].totalUsd : t[locale].totalKhr}
                  </span>
                  <span className="text-3xl font-black tracking-tight font-mono">
                    {mainCurrency === 'USD' ? `$${totalUsd.toFixed(2)}` : `${Math.round(totalKhr).toLocaleString()} ៛`}
                  </span>
                </div>
                <div className="border-t border-slate-800/80 pt-2.5 flex justify-between items-baseline">
                  <span className="text-xs font-medium text-slate-400 font-display">
                    {mainCurrency === 'USD' ? t[locale].totalKhr : t[locale].totalUsd}
                  </span>
                  <span className="text-base font-bold text-emerald-400 font-mono">
                    {mainCurrency === 'USD' ? `${Math.round(totalKhr).toLocaleString()} ៛` : `$${totalUsd.toFixed(2)}`}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-2 font-display">{t[locale].settlementType}</label>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => { setPaymentMethod('CASH'); setCheckoutResult(null); setActiveKhqr(null); }}
                  className={`py-3 px-4 rounded-xl border font-bold text-xs transition-all flex items-center justify-center gap-2 ${paymentMethod === 'CASH' ? 'bg-slate-900 text-white border-slate-900 shadow-xs' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  {t[locale].cash}
                </button>
                <button 
                  onClick={() => { setPaymentMethod('KHQR'); setCheckoutResult(null); fetchKHQRString(totalUsd); }}
                  className={`py-3 px-4 rounded-xl border font-bold text-xs transition-all flex items-center justify-center gap-2 ${paymentMethod === 'KHQR' ? 'bg-rose-600 text-white border-rose-600 shadow-xs' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  {t[locale].khqr}
                </button>
              </div>
            </div>

            {paymentMethod === 'CASH' ? (
              <div className="space-y-4">
                <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide font-display">{t[locale].tenderedKhr}</label>
                    <input 
                      type="number" 
                      value={amountPaidKhr} 
                      onChange={(e) => { setAmountPaidKhr(e.target.value); setCheckoutResult(null); }} 
                      className="w-full mt-1.5 h-10 px-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 font-mono text-sm focus:ring-2 focus:ring-indigo-50 focus:outline-hidden focus:border-indigo-500" 
                      placeholder="0" 
                      step="100"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide font-display">{t[locale].tenderedUsd}</label>
                    <input 
                      type="number" 
                      value={amountPaidUsd} 
                      onChange={(e) => { setAmountPaidUsd(e.target.value); setCheckoutResult(null); }} 
                      className="w-full mt-1.5 h-10 px-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 font-mono text-sm focus:ring-2 focus:ring-indigo-50 focus:outline-hidden focus:border-indigo-500" 
                      placeholder="0.00" 
                      step="0.01"
                      min="0.00"
                    />
                  </div>
                </div>

                {totalTenderedInUsd > 0 && (
                  <div className={`p-4 rounded-2xl border transition-all ${changeDueUsd >= 0 ? 'bg-emerald-50/50 border-emerald-200' : 'bg-amber-50/50 border-amber-200'}`}>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide font-display">
                        {changeDueUsd >= 0 ? t[locale].changeDue : t[locale].shortage}
                      </span>
                      <span className={`text-lg font-black font-mono ${changeDueUsd >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {mainCurrency === 'USD'
                          ? changeDueUsd >= 0 ? `$${changeDueUsd.toFixed(2)}` : `$${Math.abs(changeDueUsd).toFixed(2)}`
                          : changeDueUsd >= 0 ? `${Math.round(changeDueUsd * dynamicRate).toLocaleString()} ៛` : `${Math.round(Math.abs(changeDueUsd) * dynamicRate).toLocaleString()} ៛`
                        }
                      </span>
                    </div>
                    <p className="text-[10px] font-bold font-mono text-right mt-0.5 text-slate-400">
                      {mainCurrency === 'USD' 
                        ? `${Math.round(changeDueUsd * dynamicRate).toLocaleString()} ៛` 
                        : `$${changeDueUsd.toFixed(2)} USD`
                      }
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 bg-rose-50/30 border border-rose-100 p-5 rounded-2xl flex flex-col items-center">
                {activeKhqr ? (
                  <>
                    <div className="bg-white p-2.5 rounded-xl shadow-xs border border-rose-100">
                      <QRCodeCanvas value={activeKhqr.qr_string} size={160} level={"M"} includeMargin={true} />
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-xs text-slate-800 font-display">{t[locale].scanToPay}</p>
                      <p className="text-[10px] text-rose-500 font-bold font-mono mt-0.5">{t[locale].ref}: {activeKhqr.md5_hash.substring(0, 8).toUpperCase()}</p>
                      <p className="text-[9px] text-slate-400 mt-2 font-display animate-pulse">{t[locale].waitingPayment}</p>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-slate-400 font-bold font-display animate-pulse">{t[locale].assemblingPacket}</p>
                )}
              </div>
            )}
          </div>

          <div className="mt-5 space-y-3 flex-shrink-0">
            {checkoutResult && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-3.5 rounded-xl flex items-start gap-2.5">
                <span className="text-base">✅</span>
                <div className="flex-1">
                  <p className="font-bold text-xs text-emerald-900 font-display">{t[locale].orderSaved}</p>
                  {checkoutResult.change_due_khr > 0 && (
                    <p className="text-base font-black text-emerald-600 font-mono mt-0.5">{checkoutResult.change_due_khr.toLocaleString()} ៛</p>
                  )}
                </div>
              </div>
            )}
            
            {paymentMethod === 'CASH' && (
              <button
                onClick={handleCheckout}
                disabled={cart.length === 0 || totalTenderedInUsd < totalUsd}
                className={`w-full h-12 rounded-xl font-bold transition-all text-sm font-display shadow-xs ${cart.length === 0 || totalTenderedInUsd < totalUsd ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white cursor-pointer hover:bg-indigo-700 active:scale-[0.99]'}`}
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