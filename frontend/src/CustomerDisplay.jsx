import React, { useState, useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { QRCodeCanvas } from 'qrcode.react';
import { translations as t } from './locales';
import { CheckCircle2, ShoppingCart } from 'lucide-react';

export default function CustomerDisplay() {
  const [payload, setPayload] = useState(null);
  const [displayState, setDisplayState] = useState('idle');
  const doneTimerRef = useRef(null);

  useEffect(() => {
    let unlisten;
    (async () => {
      unlisten = await listen('customer-display', ({ payload: p }) => {
        setPayload(p);
        if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
        setDisplayState(p.state);
        if (p.state === 'done') {
          doneTimerRef.current = setTimeout(() => setDisplayState('idle'), 5000);
        }
      });
    })();
    return () => {
      unlisten?.();
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
    };
  }, []);

  const locale      = payload?.locale       || 'km';
  const cd          = t[locale]?.customerDisplay || t['km'].customerDisplay;
  const storeName   = payload?.storeName    || (locale === 'km' ? 'សូសូ បេប៊ី ម៉ាត' : 'SOSO Baby Mart');
  const storeIcon   = payload?.storeIcon    || '';
  const cart        = payload?.cart         || [];
  const totalUsd    = payload?.totalUsd     || 0;
  const totalKhr    = payload?.totalKhr     || 0;
  const mainCurrency   = payload?.mainCurrency  || 'USD';
  const changeDueKhr   = payload?.changeDueKhr  || 0;
  const paymentMethod  = payload?.paymentMethod || 'CASH';
  const tenderedUsd    = payload?.tenderedUsd   || 0;
  const tenderedKhr    = payload?.tenderedKhr   || 0;
  const qrString       = payload?.qrString      || null;

  const primaryTotal   = mainCurrency === 'USD' ? `$${totalUsd.toFixed(2)}` : `${Math.round(totalKhr).toLocaleString()} ៛`;
  const secondaryTotal = mainCurrency === 'USD' ? `${Math.round(totalKhr).toLocaleString()} ៛` : `$${totalUsd.toFixed(2)}`;

  const formatUnitPrice = (item) =>
    item.currency === 'KHR'
      ? `${Number(item.price).toLocaleString()} ៛`
      : `$${Number(item.price).toFixed(2)}`;

  const formatItemTotal = (item) =>
    item.currency === 'KHR'
      ? `${(item.price * item.quantity).toLocaleString()} ៛`
      : `$${(Number(item.price) * item.quantity).toFixed(2)}`;

  /* ── IDLE ───────────────────────────────────────────────── */
  if (displayState === 'idle' || !payload) {
    return (
      <div className="h-screen w-screen bg-slate-900 flex flex-col items-center justify-center gap-8 select-none overflow-hidden">
        <div className="flex flex-col items-center gap-5">
          {storeIcon
            ? <img src={storeIcon} alt="store" className="w-28 h-28 rounded-3xl object-cover shadow-2xl ring-4 ring-white/10" />
            : <div className="w-28 h-28 rounded-3xl bg-indigo-600 flex items-center justify-center shadow-2xl">
                <ShoppingCart size={56} className="text-white" />
              </div>}
          <div className="text-center">
            <h1 className="text-5xl font-black text-white tracking-tight">{storeName}</h1>
            <p className="text-slate-400 text-2xl mt-3 font-medium">{cd.welcome}</p>
          </div>
        </div>
        <p className="text-slate-600 text-sm absolute bottom-8 tracking-wide">{cd.tagline}</p>
      </div>
    );
  }

  /* ── DONE ───────────────────────────────────────────────── */
  if (displayState === 'done') {
    return (
      <div className="h-screen w-screen bg-emerald-950 flex flex-col items-center justify-center gap-7 select-none">
        <CheckCircle2 size={88} className="text-emerald-400" strokeWidth={1.5} />
        <h1 className="text-white font-black text-6xl tracking-tight">{cd.thankYou}</h1>
        {changeDueKhr > 0 && (
          <div className="bg-emerald-900/50 border border-emerald-700/60 rounded-3xl px-10 py-5 text-center mt-2">
            <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-2">{cd.change}</p>
            <p className="text-white font-black text-4xl">{changeDueKhr.toLocaleString()} ៛</p>
          </div>
        )}
      </div>
    );
  }

  /* ── ACTIVE / PAYMENT — 70 / 30 split ──────────────────── */
  const showTendered = paymentMethod === 'CASH' && (tenderedUsd > 0 || tenderedKhr > 0);
  const showKhqr     = paymentMethod === 'KHQR' && qrString;

  return (
    <div className="h-screen w-screen bg-slate-900 flex flex-col overflow-hidden select-none">
      {/* Top bar */}
      <div className="bg-slate-800 border-b border-slate-700/60 px-6 py-2.5 flex items-center gap-3 flex-shrink-0">
        {storeIcon
          ? <img src={storeIcon} alt="store" className="w-7 h-7 rounded-lg object-cover" />
          : <ShoppingCart size={17} className="text-indigo-400" />}
        <span className="text-white font-bold text-sm tracking-wide">{storeName}</span>
        <span className="ml-auto text-slate-500 text-xs font-bold uppercase tracking-widest">
          {cart.reduce((s, i) => s + i.quantity, 0)} {cd.items}
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">

        {/* LEFT — 70% — item list */}
        <div className="flex-[7] overflow-y-auto p-5 space-y-2 border-r border-slate-800">
          {cart.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-700 text-sm font-bold uppercase tracking-widest">
              {cd.welcome}
            </div>
          ) : cart.map((item, idx) => (
            <div key={item.id} className="text-lg flex items-center gap-4 bg-slate-800 rounded-2xl px-6 py-4 border border-slate-700/40">
              <p className="text-white font-bold min-w-0 truncate pr-2">{idx + 1}</p>
              <p className="text-white font-bold flex-1 min-w-0 truncate">{item.name}</p>
              <p className="text-slate-400 font-semibold flex-shrink-0">{formatUnitPrice(item)}</p>
              <p className="text-slate-500 font-bold flex-shrink-0 w-12 text-center">×{item.quantity}</p>
              <p className="text-indigo-300 font-black flex-shrink-0 w-32 text-right">{formatItemTotal(item)}</p>
            </div>
          ))}
        </div>

        {/* RIGHT — 30% — total + payment info */}
        <div className="flex-[3] flex flex-col bg-slate-850 border-l border-slate-800 overflow-hidden">

          {/* Total */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 border-b border-slate-800">
            <p className="text-slate-500 text-lg font-bold uppercase tracking-widest mb-3">{cd.total}</p>
            <p className="text-white font-black text-6xl leading-none tracking-tight text-center">{primaryTotal}</p>
            <p className="text-slate-500 text-2xl font-bold mt-2">{secondaryTotal}</p>
          </div>

          {/* Payment detail */}
          <div className="flex-2 flex flex-col items-center justify-center px-6 py-6 gap-4">

            {showKhqr && (
              <>
                <div className="bg-white p-3 rounded-2xl shadow-lg">
                  <QRCodeCanvas value={qrString} size={160} level="M" includeMargin={false} />
                </div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest text-center">
                  {locale === 'km' ? 'ស្កេនដើម្បីទូទាត់' : 'Scan to pay via KHQR'}
                </p>
              </>
            )}

            {showTendered && (
              <div className="w-full space-y-3">
                {tenderedKhr > 0 && (
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-500 text-xl font-bold uppercase tracking-wide">
                      {locale === 'km' ? 'ទទួល (KHR)' : 'Tendered (KHR)'}
                    </span>
                    <span className="text-slate-200 font-black text-3xl">{tenderedKhr.toLocaleString()} ៛</span>
                  </div>
                )}
                {tenderedUsd > 0 && (
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-500 text-xl font-bold uppercase tracking-wide">
                      {locale === 'km' ? 'ទទួល (USD)' : 'Tendered (USD)'}
                    </span>
                    <span className="text-slate-200 font-black text-3xl">${tenderedUsd.toFixed(2)}</span>
                  </div>
                )}
                {changeDueKhr > 0 && (
                  <div className="flex justify-between items-baseline border-t border-slate-700 pt-3 mt-1">
                    <span className="text-emerald-400 text-xl font-bold uppercase tracking-wide">{cd.change}</span>
                    <span className="text-emerald-400 font-black text-3xl">{changeDueKhr.toLocaleString()} ៛</span>
                  </div>
                )}
              </div>
            )}

            {!showKhqr && !showTendered && (
              <p className="text-slate-700 text-xs font-bold uppercase tracking-widest text-center">
                {paymentMethod === 'STATIC_QR'
                  ? (locale === 'km' ? 'QR ធនាគារ' : 'Bank QR')
                  : cd.awaitingPayment}
              </p>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
