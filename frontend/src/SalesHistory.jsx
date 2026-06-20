import React, { useState, useEffect, useCallback } from 'react';
import { translations as t } from './locales';

const BACKEND_URL = 'http://localhost:5050';

function getPeriodRange(period) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'today') return { from: startOfToday.toISOString(), to: null };
  if (period === 'week')  { const d = new Date(startOfToday); d.setDate(d.getDate() - 7);  return { from: d.toISOString(), to: null }; }
  if (period === 'month') { const d = new Date(startOfToday); d.setDate(d.getDate() - 30); return { from: d.toISOString(), to: null }; }
  return { from: null, to: null };
}

export default function SalesHistory({ onBackToRegister, currentLocale, dynamicRate, mainCurrency }) {
  const s = t[currentLocale].salesHistory;

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('today');
  const [expandedId, setExpandedId] = useState(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { from, to } = getPeriodRange(period);
    const params = new URLSearchParams();
    if (from) params.set('date_from', from);
    if (to)   params.set('date_to', to);
    try {
      const res = await fetch(`${BACKEND_URL}/api/orders?${params}`);
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.total_amount_usd || 0), 0);
  const cashCount   = orders.filter(o => o.payment_method === 'CASH').length;
  const khqrCount   = orders.filter(o => o.payment_method === 'KHQR').length;

  const formatDateTime = (ts) =>
    new Date(ts).toLocaleString(currentLocale === 'km' ? 'km-KH' : 'en-US', {
      month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });

  const PERIODS = ['today', 'week', 'month', 'all'];

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-50 flex flex-col font-sans text-slate-900 antialiased">

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex justify-between items-center shadow-xs flex-shrink-0">
        <div className="flex items-center gap-3.5">
          <button
            onClick={onBackToRegister}
            className="px-3.5 py-1.5 hover:bg-slate-100 border border-transparent hover:border-slate-200 rounded-xl text-xs font-bold text-slate-600 transition-all flex items-center gap-1.5"
          >
            ← {s.backBtn}
          </button>
          <div className="h-6 w-px bg-slate-200" />
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">{s.title}</h1>
            <p className="text-[11px] font-bold text-indigo-600 tracking-wider uppercase">{s.subtitle}</p>
          </div>
        </div>

        {/* Period tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => { setPeriod(p); setExpandedId(null); }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                period === p ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {s[p]}
            </button>
          ))}
        </div>
      </header>

      {/* Summary bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-8 flex-shrink-0">
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{s.totalRevenue}</p>
          <p className="text-2xl font-black text-slate-900 font-mono leading-none">
            {mainCurrency === 'USD'
              ? `$${totalRevenue.toFixed(2)}`
              : `${Math.round(totalRevenue * dynamicRate).toLocaleString()} ៛`}
          </p>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            {mainCurrency === 'USD'
              ? `${Math.round(totalRevenue * dynamicRate).toLocaleString()} ៛`
              : `$${totalRevenue.toFixed(2)}`}
          </p>
        </div>

        <div className="h-12 w-px bg-slate-200" />

        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{s.totalOrders}</p>
          <p className="text-2xl font-black text-slate-900 font-mono leading-none">{orders.length}</p>
        </div>

        <div className="h-12 w-px bg-slate-200" />

        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <span className="text-base">💵</span>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{s.cashSales}</p>
              <p className="text-sm font-black text-slate-700 font-mono">{cashCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base">📱</span>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{s.khqrSales}</p>
              <p className="text-sm font-black text-slate-700 font-mono">{khqrCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Order list */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm font-bold">{s.loading}</div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-2xl">🗂️</div>
            <p className="text-sm font-semibold">{s.noOrders}</p>
          </div>
        ) : (
          <div className="space-y-2 max-w-4xl mx-auto">
            {/* Table header */}
            <div className="grid grid-cols-[56px_1fr_80px_120px_80px_32px] gap-3 px-4 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <span>{s.orderId}</span>
              <span>{s.dateTime}</span>
              <span className="text-center">{s.itemCount}</span>
              <span className="text-right">{s.total}</span>
              <span className="text-center">{s.payment}</span>
              <span />
            </div>

            {orders.map(order => (
              <OrderRow
                key={order.id}
                order={order}
                s={s}
                dynamicRate={dynamicRate}
                mainCurrency={mainCurrency}
                locale={currentLocale}
                expanded={expandedId === order.id}
                onToggle={() => setExpandedId(expandedId === order.id ? null : order.id)}
                formatDateTime={formatDateTime}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OrderRow({ order, s, dynamicRate, mainCurrency, locale, expanded, onToggle, formatDateTime }) {
  const itemCount = (order.items || []).filter(i => i.product_name).length;
  const totalUsd = parseFloat(order.total_amount_usd);
  const totalKhr = Math.round(totalUsd * dynamicRate);

  return (
    <div className={`bg-white rounded-2xl border transition-all overflow-hidden ${expanded ? 'border-indigo-200 shadow-sm' : 'border-slate-200/80 hover:border-slate-300'}`}>
      {/* Row summary */}
      <button
        onClick={onToggle}
        className="w-full grid grid-cols-[56px_1fr_80px_120px_80px_32px] gap-3 px-4 py-3.5 items-center text-left"
      >
        <span className="font-black text-sm text-indigo-600 font-mono">#{String(order.id).padStart(4, '0')}</span>

        <span className="text-sm text-slate-700 font-medium truncate">{formatDateTime(order.created_at)}</span>

        <span className="text-sm text-slate-600 font-bold font-mono text-center">
          {itemCount}
        </span>

        <div className="text-right">
          <p className="text-sm font-black text-slate-900 font-mono">
            {mainCurrency === 'USD' ? `$${totalUsd.toFixed(2)}` : `${totalKhr.toLocaleString()} ៛`}
          </p>
          <p className="text-[10px] text-slate-400 font-mono">
            {mainCurrency === 'USD' ? `${totalKhr.toLocaleString()} ៛` : `$${totalUsd.toFixed(2)}`}
          </p>
        </div>

        <div className="flex justify-center">
          <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
            order.payment_method === 'CASH'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-rose-50 text-rose-700'
          }`}>
            {order.payment_method === 'CASH' ? s.cash : s.khqr}
          </span>
        </div>

        <span className={`text-slate-400 text-xs font-bold transition-transform ${expanded ? 'rotate-90' : ''}`}>›</span>
      </button>

      {/* Expanded item details */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 bg-slate-50/50">
          {/* Items table */}
          <div className="mb-3">
            <div className="grid grid-cols-[1fr_48px_80px_80px] gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5 px-1">
              <span>Item</span>
              <span className="text-center">{s.qty}</span>
              <span className="text-right">{s.unitPrice}</span>
              <span className="text-right">{s.subtotal}</span>
            </div>
            <div className="space-y-1">
              {(order.items || []).filter(i => i.product_name).map((item, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_48px_80px_80px] gap-2 text-xs px-1 py-0.5">
                  <span className="text-slate-800 font-medium truncate">{item.product_name}</span>
                  <span className="text-center text-slate-600 font-mono font-bold">{item.quantity}</span>
                  <span className="text-right text-slate-600 font-mono">${parseFloat(item.price_usd).toFixed(2)}</span>
                  <span className="text-right text-slate-900 font-mono font-bold">
                    ${(parseFloat(item.price_usd) * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Payment breakdown */}
          <div className="border-t border-slate-200 pt-2.5 space-y-1 text-xs">
            {parseFloat(order.amount_paid_usd) > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>{s.payment} (USD)</span>
                <span className="font-mono">${parseFloat(order.amount_paid_usd).toFixed(2)}</span>
              </div>
            )}
            {parseFloat(order.amount_paid_khr) > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>{s.payment} (KHR)</span>
                <span className="font-mono">{parseFloat(order.amount_paid_khr).toLocaleString()} ៛</span>
              </div>
            )}
            {parseFloat(order.change_given_khr) > 0 && (
              <div className="flex justify-between font-bold text-emerald-700">
                <span>{s.change}</span>
                <span className="font-mono">{parseFloat(order.change_given_khr).toLocaleString()} ៛</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
