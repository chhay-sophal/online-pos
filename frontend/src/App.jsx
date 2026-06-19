import React, { useState, useEffect, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

export default function App() {
  const [cart, setCart] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [amountPaidUsd, setAmountPaidUsd] = useState('');
  const [amountPaidKhr, setAmountPaidKhr] = useState('');
  const [checkoutResult, setCheckoutResult] = useState(null);
  
  // Track the generated active QR string metadata from the backend
  const [activeKhqr, setActiveKhqr] = useState(null);
  
  const barcodeRef = useRef(null);
  const BACKEND_URL = 'http://localhost:5050';

  useEffect(() => {
    focusScanner();
  }, []);

  const focusScanner = () => {
    if (barcodeRef.current) barcodeRef.current.focus();
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
            clearInterval(pollingInterval); // Stop container requests immediately
            
            // Execute automated checkout payload submission
            await autoCommitKhqrOrder(activeKhqr);
          }
        } catch (err) {
          console.error('Error running automated payment check:', err);
        }
      }, 3000); // Probe database verification loop every 3 seconds
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
    setActiveKhqr(null); // Reset layout generation on modifications
  };

  const removeItem = (id) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== id));
    setCheckoutResult(null);
    setActiveKhqr(null);
  };

  const totalUsd = cart.reduce((sum, item) => sum + (item.price_usd * item.quantity), 0);
  const totalKhr = totalUsd * 4100;

  // Automated Checkout execution strictly targeted for verified KHQR receipts
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
        bank_name: 'Bakong Network Channel'
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
        focusScanner();
      }
    } catch (err) {
      console.error('Error auto-finalizing transaction process:', err);
    }
  };

  // Traditional manual Cash submission layout handler
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
        focusScanner();
      } else {
        alert(`Checkout Failed: ${data.error}`);
      }
    } catch (err) {
      console.error('Error checking out:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 antialiased">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-xs">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 text-white p-2.5 rounded-xl font-bold text-lg">👶</div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">BABY MART</h1>
            <p className="text-xs font-semibold text-indigo-600 tracking-wider uppercase">In-Store Register</p>
          </div>
        </div>
        <div className="bg-slate-100 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600">
          Exchange Rate: <span className="font-bold text-slate-900">$1 = 4,100 ៛</span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Operations */}
        <div className="flex-1 p-6 flex flex-col overflow-y-auto gap-6 max-w-5xl mx-auto w-full">
          <form onSubmit={handleBarcodeSubmit} className="relative">
            <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 text-xl">⚡</span>
            <input
              ref={barcodeRef}
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Awaiting hardware barcode scan input..."
              className="w-full pl-11 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-lg font-medium shadow-xs focus:outline-hidden focus:border-indigo-500 focus:ring-3 focus:ring-indigo-100 placeholder:text-slate-400"
            />
          </form>

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
                          <p className="font-bold text-slate-900">${(item.price_usd * item.quantity).toFixed(2)}</p>
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
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                <div>
                  <label className="text-xs font-bold text-slate-500">Tendered Cash Amount (USD)</label>
                  <input type="number" value={amountPaidUsd} onChange={(e) => setAmountPaidUsd(e.target.value)} className="w-full mt-1.5 p-2.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-800" placeholder="0.00" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500">Tendered Cash Amount (KHR)</label>
                  <input type="number" value={amountPaidKhr} onChange={(e) => setAmountPaidKhr(e.target.value)} className="w-full mt-1.5 p-2.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-800" placeholder="0" />
                </div>
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