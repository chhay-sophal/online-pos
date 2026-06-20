import React, { useState, useEffect, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import StockManager from './StockManager';
import SettingsManager from './SettingsManager';

export default function App() {
  const [cart, setCart] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [amountPaidUsd, setAmountPaidUsd] = useState('');
  const [amountPaidKhr, setAmountPaidKhr] = useState('');
  const [checkoutResult, setCheckoutResult] = useState(null);
  const [view, setView] = useState('REGISTER');
  const [activeKhqr, setActiveKhqr] = useState(null);
  const [dynamicRate, setDynamicRate] = useState(4100);
  const [showManualInput, setShowManualInput] = useState(false);
  
  const barcodeRef = useRef(null);
  const BACKEND_URL = 'http://localhost:5050';

  useEffect(() => {
    focusScanner();
  }, [view]);

  // Automated Global Barcode Background Listening Engine
  useEffect(() => {
    // Only activate global keyboard intercept when the user is actively inside the REGISTER view
    if (view !== 'REGISTER') return;

    let keyBuffer = '';
    let lastTimestamp = Date.now();

    const handleGlobalScanStream = (e) => {
      // CRITICAL: If the cursor is focused inside ANY input field (like cash fields or our manual input), 
      // do not let the global background listener intercept the keys!
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
      
      const currentTimestamp = Date.now();
      
      // Check timing signature: Hardware scanners typically type characters sub-50ms.
      // If the time between keypresses is long, a human is manually typing. Clear the buffer.
      if (currentTimestamp - lastTimestamp > 50) {
        keyBuffer = '';
      }
      
      lastTimestamp = currentTimestamp;

      // Detect the automated carriage return suffix key ('Enter') appended by the scanner gun
      if (e.key === 'Enter') {
        const cleanBarcode = keyBuffer.trim();
        if (cleanBarcode.length > 0) {
          console.log(`⚡ [GLOBAL BACKGROUND SCANNER] Caught Barcode Sequence: "${cleanBarcode}"`);
          
          // Emulate input form dispatch sequence by passing the buffered string straight to our API lookup logic
          executeDirectBarcodeLookup(cleanBarcode);
          
          keyBuffer = ''; // Flush memory array ready for next item check
        }
        return;
      }

      // Capture standard single alphanumeric characters, ignoring structural modifiers like 'Shift' or 'Control'
      if (e.key.length === 1) {
        keyBuffer += e.key;
      }
    };

    // Helper method matching your existing fetch lookup block architecture
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
    
    // Cleanup hook to tear down listeners when the component unmounts or view states shift
    return () => {
      window.removeEventListener('keydown', handleGlobalScanStream);
    };
  }, [view, BACKEND_URL]);

  useEffect(() => {
    // Pull dynamic settings variables from backend
    fetch(`${BACKEND_URL}/api/settings`)
      .then(res => res.json())
      .then(data => {
        if (data.exchange_rate) setDynamicRate(Number(data.exchange_rate));
      })
      .catch(err => console.error("Could not sync app settings configuration", err));
  }, [view]); // Automatically syncs whenever you shift back to the main register view

  const focusScanner = () => {
    if (view === 'REGISTER' && barcodeRef.current) barcodeRef.current.focus();
  };

  // Automated Verification Polling Engine Effect Loop
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

  const totalUsd = cart.reduce((sum, item) => sum + (item.price_usd * item.quantity), 0);
  const totalKhr = totalUsd * dynamicRate;

  // --- LIVE CHANGE CALCULATION ENGINE ---
  // 1. Convert whatever raw cash text inputs the cashier typed into floating numbers safely
  const tenderedUsd = parseFloat(amountPaidUsd || 0);
  const tenderedKhr = parseFloat(amountPaidKhr || 0);

  // 2. Combine both currencies into a single master USD value
  const totalTenderedInUsd = tenderedUsd + (tenderedKhr / 4100);

  // 3. Calculate the remaining balance gap
  const changeDueUsd = totalTenderedInUsd - totalUsd;

  // 4. Convert that gap to a clean, rounded Riel integer if they paid over the total limit
  const changeDueKhr = changeDueUsd > 0 ? Math.round(changeDueUsd * 4100) : 0;

  const autoCommitKhqrOrder = async (khqrDetails) => {
    const payload = {
      items: cart,
      payment_method: 'KHQR',
      total_amount_usd: totalUsd,
      amount_paid_usd: totalUsd,
      amount_paid_khr: 0,
      khqr_data: {
        md5_hash: khqrDetails.md5_hash,
        qr_string: khqrDetails.qr_string,
        currency: 'USD',
        bank_name: 'Bakong Network'
      }
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

    const payload = {
      items: cart,
      payment_method: paymentMethod,
      total_amount_usd: totalUsd,
      amount_paid_usd: paymentMethod === 'CASH' ? parseFloat(amountPaidUsd || 0) : totalUsd,
      amount_paid_khr: paymentMethod === 'CASH' ? parseFloat(amountPaidKhr || 0) : 0,
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
    return <StockManager onBackToRegister={() => setView('REGISTER')} />;
  }

  if (view === 'SETTINGS') {
    return <SettingsManager onBackToRegister={() => setView('REGISTER')} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 antialiased">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-xs">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 text-white p-2.5 rounded-xl font-bold text-lg">👶</div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">BABY MART</h1>
            <p className="text-xs font-semibold text-indigo-600 tracking-wider uppercase">In-Store Register</p>
          </div>
          <button 
            onClick={() => setView('STOCK')}
            className="ml-4 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-600 transition-colors"
          >
            ⚙️ Manage Inventory Stock
          </button>
          <button 
            onClick={() => setView('SETTINGS')}
            className="ml-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-600 transition-colors"
          >
            ⚙️ Settings
          </button>
        </div>
        <div className="bg-slate-100 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600">
          Exchange Rate: <span className="font-bold text-slate-900">$1 = {dynamicRate.toLocaleString()}</span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Operations */}
        <div className="flex-1 p-6 flex flex-col overflow-y-auto gap-6 max-w-5xl mx-auto w-full">
          {/* Background listener active status banner with Manual Type Fallback functionality */}
          <div className="bg-indigo-50/50 border border-indigo-200 px-6 py-4 rounded-2xl text-indigo-700 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl animate-pulse">📡</span>
                <p className="text-sm font-semibold">
                  Background listener active. Scan any item barcode at any time.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowManualInput(!showManualInput);
                  setBarcodeInput('');
                }}
                className="text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-bold px-3 py-1.5 rounded-lg transition-colors"
              >
                {showManualInput ? '🔒 Close Manual Entry' : '⌨️ Type Barcode Manually'}
              </button>
            </div>

            {/* Hidden text form wrapper that slides into view when clicked */}
            {showManualInput && (
              <form onSubmit={handleBarcodeSubmit} className="flex gap-2 animate-fadeIn pt-1">
                <input
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Type barcode digits manually (e.g. 8904091113606)..."
                  className="flex-1 px-4 py-2 bg-white border border-indigo-200 text-slate-800 rounded-xl text-sm font-mono font-medium focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-colors shadow-xs"
                >
                  Add Item
                </button>
              </form>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex-1 flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h2 className="font-bold text-slate-800 tracking-tight">Current Basket Queue</h2>
              <span className="text-xs bg-slate-200 text-slate-700 font-bold px-2.5 py-1 rounded-full">{cart.reduce((a, b) => a + b.quantity, 0)} Items</span>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                  <span className="text-4xl">🛒</span>
                  <p className="font-medium text-slate-500">Registry tray is empty.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex-1 min-w-0 pr-4">
                        <h3 className="font-semibold text-slate-900 truncate">{item.name}</h3>
                        <p className="text-xs text-slate-400 font-mono">#{item.barcode}</p>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="flex items-center border border-slate-200 bg-white rounded-lg p-1">
                          <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 flex items-center justify-center font-bold text-slate-500 hover:bg-slate-50 rounded-md">&minus;</button>
                          <span className="w-10 text-center font-bold text-slate-800">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 flex items-center justify-center font-bold text-slate-500 hover:bg-slate-50 rounded-md">+</button>
                        </div>
                        <div className="text-right w-24">
                          <p className="font-bold text-slate-900">${(Number(item.price_usd) * item.quantity).toFixed(2)}</p>
                        </div>
                        <button onClick={() => removeItem(item.id)} className="text-slate-400 hover:text-rose-500 p-1 text-lg">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Payment Context */}
        <div className="w-100 bg-white border-l border-slate-200 shadow-xl p-6 flex flex-col justify-between overflow-y-auto">
          <div>
            <h2 className="text-xs font-bold tracking-wider text-slate-400 uppercase mb-4">Payment Statement</h2>
            
            <div className="bg-slate-900 text-white rounded-2xl p-5 mb-6 relative overflow-hidden">
              <div className="space-y-4 relative z-10">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-medium text-slate-400">Total USD</span>
                  <span className="text-4xl font-black tracking-tight">${totalUsd.toFixed(2)}</span>
                </div>
                <div className="border-t border-slate-800 pt-3 flex justify-between items-baseline">
                  <span className="text-xs font-medium text-slate-400">Total KHR</span>
                  <span className="text-lg font-bold text-emerald-400 font-mono">{totalKhr.toLocaleString()} ៛</span>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold tracking-wider text-slate-400 uppercase mb-2">Settlement Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => { setPaymentMethod('CASH'); setCheckoutResult(null); setActiveKhqr(null); }}
                  className={`py-3 px-4 rounded-xl border font-bold text-sm transition-all flex items-center justify-center gap-2 ${paymentMethod === 'CASH' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600'}`}
                >
                  💵 Cash
                </button>
                <button 
                  onClick={() => { setPaymentMethod('KHQR'); setCheckoutResult(null); fetchKHQRString(totalUsd); }}
                  className={`py-3 px-4 rounded-xl border font-bold text-sm transition-all flex items-center justify-center gap-2 ${paymentMethod === 'KHQR' ? 'bg-rose-500 text-white border-rose-500' : 'bg-white border-slate-200 text-slate-600'}`}
                >
                  📱 KHQR Digital
                </button>
              </div>
            </div>

            {paymentMethod === 'CASH' ? (
              <div className="space-y-4">
                {/* Input Tenders Container */}
                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tendered Cash Amount (USD)</label>
                    <input 
                      type="number" 
                      value={amountPaidUsd} 
                      onChange={(e) => { setAmountPaidUsd(e.target.value); setCheckoutResult(null); }} 
                      className="w-full mt-1.5 p-2.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-indigo-100 focus:outline-hidden" 
                      placeholder="0.00" 
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tendered Cash Amount (KHR)</label>
                    <input 
                      type="number" 
                      value={amountPaidKhr} 
                      onChange={(e) => { setAmountPaidKhr(e.target.value); setCheckoutResult(null); }} 
                      className="w-full mt-1.5 p-2.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-indigo-100 focus:outline-hidden" 
                      placeholder="0" 
                    />
                  </div>
                </div>

                {/* LIVE CALCULATION REFCARD READOUT */}
                {totalTenderedInUsd > 0 && (
                  <div className={`p-4 rounded-xl border transition-all ${changeDueUsd >= 0 ? 'bg-emerald-50/60 border-emerald-200' : 'bg-amber-50/60 border-amber-200'}`}>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                        {changeDueUsd >= 0 ? '💰 Change Due to Customer:' : '⏳ Remaining Shortage:'}
                      </span>
                      <span className={`text-xl font-black font-mono ${changeDueUsd >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {changeDueUsd >= 0 
                          ? `${changeDueKhr.toLocaleString()} ៛` 
                          : `${Math.abs(Math.round(changeDueUsd * 4100)).toLocaleString()} ៛`
                        }
                      </span>
                    </div>
                    {changeDueUsd > 0 && (
                      <p className="text-[10px] text-emerald-600 font-semibold text-right mt-1">
                        approx. ${(changeDueUsd).toFixed(2)} USD
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 bg-rose-50/40 border border-rose-100 p-5 rounded-2xl flex flex-col items-center">
                {activeKhqr ? (
                  <>
                    <div className="bg-white p-3 rounded-xl shadow-xs border border-rose-100">
                      <QRCodeCanvas value={activeKhqr.qr_string} size={180} level={"M"} includeMargin={true} />
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-sm text-slate-800">Scan to Pay via KHQR</p>
                      <p className="text-xs text-rose-500 font-semibold font-mono mt-0.5">Ref: {activeKhqr.md5_hash.substring(0, 8).toUpperCase()}</p>
                      <p className="text-[10px] text-slate-400 mt-2 animate-pulse">Waiting for customer payment detection...</p>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-slate-400 font-medium animate-pulse">Assembling secure banking packet...</p>
                )}
              </div>
            )}
          </div>

          <div className="mt-6 space-y-4">
            {checkoutResult && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-xl flex items-start gap-3">
                <span className="text-xl">✅</span>
                <div className="flex-1">
                  <p className="font-bold text-sm text-emerald-900">Order successfully saved!</p>
                  {checkoutResult.change_due_khr > 0 && (
                    <p className="text-lg font-black text-emerald-600 font-mono mt-1">{checkoutResult.change_due_khr.toLocaleString()} ៛</p>
                  )}
                </div>
              </div>
            )}
            
            {paymentMethod === 'CASH' && (
              <button 
                onClick={handleCheckout}
                disabled={cart.length === 0}
                className={`w-full py-4 rounded-xl font-bold transition-all text-base ${cart.length === 0 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white cursor-pointer hover:bg-indigo-700'}`}
              >
                Finalize Counter Order
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}