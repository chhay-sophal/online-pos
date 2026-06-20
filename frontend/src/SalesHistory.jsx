import React, { useState, useEffect, useCallback } from 'react';
import { translations as t } from './locales';

const PAGE_SIZE = 10;
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
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState('id');
  const [sortDir, setSortDir] = useState('desc');
  const [payFilter, setPayFilter] = useState('all');
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [search, period, payFilter, sortCol, sortDir]);

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

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };
  const si = (col) => (
    <span className={sortCol === col ? 'text-indigo-400' : 'text-slate-300'}>
      {sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
    </span>
  );

  const q = search.trim().toLowerCase();
  const filteredOrders = [...orders]
    .filter(o => payFilter === 'all' || o.payment_method === payFilter)
    .filter(o => !q || String(o.id).includes(q) || o.payment_method.toLowerCase().includes(q) || (o.items || []).some(i => i.product_name && i.product_name.toLowerCase().includes(q)))
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortCol) {
        case 'date':      return dir * (new Date(a.created_at) - new Date(b.created_at));
        case 'itemCount': {
          const aC = (a.items || []).filter(i => i.product_name).length;
          const bC = (b.items || []).filter(i => i.product_name).length;
          return dir * (aC - bC);
        }
        case 'total':   return dir * (parseFloat(a.total_amount) - parseFloat(b.total_amount));
        case 'payment': return dir * a.payment_method.localeCompare(b.payment_method);
        default:        return dir * (a.id - b.id);
      }
    });

  const totalPages = Math.ceil(filteredOrders.length / PAGE_SIZE);
  const pageNums = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = [1];
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    if (totalPages > 1) pages.push(totalPages);
    return pages;
  })();
  const pagedOrders = filteredOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalRevenue = filteredOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
  // counts from unfiltered orders so payment filter buttons always show full period totals
  const cashCount = orders.filter(o => o.payment_method === 'CASH').length;
  const khqrCount = orders.filter(o => o.payment_method === 'KHQR').length;

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

        <div className="flex items-center gap-3 flex-1 mx-6">
          <div className="relative flex-1 max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setExpandedId(null); }}
              placeholder={s.searchPlaceholder}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-100 border border-transparent focus:border-indigo-300 focus:bg-white rounded-xl outline-none transition-all placeholder:text-slate-400 font-medium"
            />
            {search && (
              <button
                onClick={() => { setSearch(''); setExpandedId(null); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >✕</button>
            )}
          </div>
        </div>

        {/* Period tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl flex-shrink-0">
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
          <p className="text-2xl font-black text-slate-900 font-mono leading-none">{filteredOrders.length}</p>
        </div>

        <div className="h-12 w-px bg-slate-200" />

        <div className="flex gap-2">
          {[
            { key: 'CASH', label: s.cashSales, icon: '💵', count: cashCount, activeClass: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
            { key: 'KHQR', label: s.khqrSales, icon: '📱', count: khqrCount, activeClass: 'bg-rose-50 border-rose-200 text-rose-700' },
          ].map(({ key, label, icon, count, activeClass }) => (
            <button
              key={key}
              onClick={() => setPayFilter(f => f === key ? 'all' : key)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${
                payFilter === key ? activeClass : 'border-transparent hover:bg-slate-50 text-slate-700'
              }`}
            >
              <span className="text-base">{icon}</span>
              <div className="text-left">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                <p className="text-sm font-black font-mono">{count}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Order list */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm font-bold">{s.loading}</div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-2xl">🗂️</div>
              <p className="text-sm font-semibold">{s.noOrders}</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-2xl">🔍</div>
              <p className="text-sm font-semibold">{s.noResults}</p>
            </div>
          ) : (
            <div className="space-y-2 max-w-4xl mx-auto">
              {/* Table header */}
              <div className="grid grid-cols-[56px_1fr_80px_120px_80px_32px] gap-3 px-4 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <button className="text-left cursor-pointer hover:text-slate-600 select-none" onClick={() => toggleSort('id')}>{s.orderId}{si('id')}</button>
                <button className="text-left cursor-pointer hover:text-slate-600 select-none" onClick={() => toggleSort('date')}>{s.dateTime}{si('date')}</button>
                <button className="text-center cursor-pointer hover:text-slate-600 select-none" onClick={() => toggleSort('itemCount')}>{s.itemCount}{si('itemCount')}</button>
                <button className="text-right cursor-pointer hover:text-slate-600 select-none" onClick={() => toggleSort('total')}>{s.total}{si('total')}</button>
                <button className="text-center cursor-pointer hover:text-slate-600 select-none" onClick={() => toggleSort('payment')}>{s.payment}{si('payment')}</button>
                <span />
              </div>

              {pagedOrders.map(order => (
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

        {/* Pagination footer — always visible at the bottom */}
        {!loading && totalPages > 1 && (
          <div className="bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
            <span className="text-xs text-slate-400 font-medium">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredOrders.length)} of {filteredOrders.length}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => p - 1)} disabled={page === 1} className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all">←</button>
              {pageNums.map((n, i) => n === '...'
                ? <span key={`e${i}`} className="px-1 text-slate-300 text-xs">…</span>
                : <button key={n} onClick={() => setPage(n)} className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${page === n ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>{n}</button>
              )}
              <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages} className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all">→</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function OrderRow({ order, s, dynamicRate, mainCurrency, locale, expanded, onToggle, formatDateTime }) {
  const itemCount = (order.items || []).filter(i => i.product_name).length;
  const totalUsd = parseFloat(order.total_amount);
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

        <span className={`inline-block w-2 h-2 border-r-2 border-b-2 border-slate-400 transition-transform ${expanded ? 'rotate-45' : '-rotate-45'}`} />
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
                  <span className="text-right text-slate-600 font-mono">
                    {item.currency === 'KHR'
                      ? `${parseFloat(item.price).toLocaleString()} ៛`
                      : `$${parseFloat(item.price).toFixed(2)}`}
                  </span>
                  <span className="text-right text-slate-900 font-mono font-bold">
                    {item.currency === 'KHR'
                      ? `${(parseFloat(item.price) * item.quantity).toLocaleString()} ៛`
                      : `$${(parseFloat(item.price) * item.quantity).toFixed(2)}`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Payment breakdown */}
          <div className="border-t border-slate-200 pt-2.5 space-y-1 text-xs">
            {mainCurrency === 'KHR' && parseFloat(order.amount_paid_khr) > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>{s.paidKhr}</span>
                <span className="font-mono">{parseFloat(order.amount_paid_khr).toLocaleString()} ៛</span>
              </div>
            )}
            {parseFloat(order.amount_paid_usd) > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>{s.paidUsd}</span>
                <span className="font-mono">${parseFloat(order.amount_paid_usd).toFixed(2)}</span>
              </div>
            )}
            {mainCurrency === 'USD' && parseFloat(order.amount_paid_khr) > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>{s.paidKhr}</span>
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
