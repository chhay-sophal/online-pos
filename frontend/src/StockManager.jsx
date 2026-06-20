import React, { useState, useEffect } from 'react';
import { translations as t } from './locales';

const PAGE_SIZE = 15;

export default function StockManager({ onBackToRegister, currentLocale, mainCurrency = 'USD', dynamicRate = 4100 }) {
  const [products, setProducts] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', barcode: '', price: '', currency: 'USD', stock: '' });
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState('id');
  const [sortDir, setSortDir] = useState('asc');
  const [currFilter, setCurrFilter] = useState('all');
  const [lowStock, setLowStock] = useState(false);
  const [page, setPage] = useState(1);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', barcode: '', price: '', currency: 'USD', stock: '' });

  useEffect(() => { setPage(1); }, [search, sortCol, sortDir, currFilter, lowStock]);

  const BACKEND_URL = 'http://localhost:5050';
  
  const labels = t[currentLocale]?.stock || t['km'].stock;

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/products`);
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      }
    } catch (err) {
      console.error('Failed to grab product inventory mapping:', err);
    }
  };

  const handleEditClick = (product) => {
    setEditingId(product.id);
    setEditForm({
      name: product.name,
      barcode: product.barcode,
      price: product.price || '',
      currency: product.currency || 'USD',
      stock: product.stock,
    });
  };

  const priceEquivalent = (form) => {
    const p = parseFloat(form.price);
    if (!p) return null;
    return form.currency === 'USD'
      ? `≈ ${Math.round(p * dynamicRate).toLocaleString()} ៛`
      : `≈ $${(p / dynamicRate).toFixed(2)}`;
  };

  const handleSaveEdit = async (id) => {
    if (!editForm.name || !editForm.barcode || !editForm.price) {
      alert(labels.alertMandatory || 'Please fill out all mandatory fields.');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          barcode: editForm.barcode,
          price: parseFloat(editForm.price),
          currency: editForm.currency,
          stock: parseInt(editForm.stock, 10) || 0,
        }),
      });

      if (response.ok) {
        setEditingId(null);
        fetchInventory();
      } else {
        alert(labels.alertUpdateFail || 'Failed to update product details.');
      }
    } catch (err) {
      console.error('Error modifying product asset rows:', err);
    }
  };

  const handleAddProductSubmit = async (e) => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.barcode || !newProduct.price) {
      alert(labels.alertMandatory || 'Please fill out all mandatory identity fields');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProduct.name,
          barcode: newProduct.barcode,
          price: parseFloat(newProduct.price),
          currency: newProduct.currency,
          stock: parseInt(newProduct.stock, 10) || 0,
        }),
      });

      if (response.ok) {
        setNewProduct({ name: '', barcode: '', price: '', currency: 'USD', stock: '' });
        setShowAddForm(false);
        fetchInventory();
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Failed to initialize database product card.'}`);
      }
    } catch (err) {
      console.error('Error adding product record:', err);
    }
  };

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
  const toUsd = (p) => p.currency === 'KHR' ? parseFloat(p.price) / dynamicRate : parseFloat(p.price);
  const displayed = [...products]
    .filter(p => !q || p.name.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q))
    .filter(p => currFilter === 'all' || p.currency === currFilter)
    .filter(p => !lowStock || p.stock <= 5)
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortCol) {
        case 'name':    return dir * a.name.localeCompare(b.name);
        case 'barcode': return dir * a.barcode.localeCompare(b.barcode);
        case 'price':   return dir * (toUsd(a) - toUsd(b));
        case 'stock':   return dir * (a.stock - b.stock);
        default:        return dir * (a.id - b.id);
      }
    });

  const totalPages = Math.ceil(displayed.length / PAGE_SIZE);
  const pageNums = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = [1];
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    if (totalPages > 1) pages.push(totalPages);
    return pages;
  })();
  const paged = displayed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans text-slate-900 antialiased overflow-hidden">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-xs flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBackToRegister}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-semibold transition-colors text-slate-600 font-display cursor-pointer"
          >
            ⬅ {t[currentLocale]?.register || 'Register'}
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight font-display">
              {t[currentLocale]?.manageInventory || 'Inventory Management'}
            </h1>
            <p className="text-xs font-bold text-indigo-600 tracking-wider uppercase font-display">
              {labels.inventoryLedger || 'Inventory Stock Ledger'}
            </p>
          </div>
        </div>

        <div className="relative mx-6 flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setEditingId(null); }}
            placeholder={labels.searchPlaceholder}
            className="w-full pl-8 pr-8 py-2 text-sm bg-slate-100 border border-transparent focus:border-indigo-300 focus:bg-white rounded-xl outline-none transition-all placeholder:text-slate-400 font-medium"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >✕</button>
          )}
        </div>

        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-sm transition-all flex items-center gap-2 font-display cursor-pointer active:scale-95 flex-shrink-0"
        >
          {labels.registerNewProduct || '➕ Register New Product'}
        </button>
      </header>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 p-6 pb-0 max-w-6xl mx-auto w-full overflow-hidden flex flex-col">
          {/* Data Matrix Grid Table Wrapper */}
          <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col">
          {/* Filter bar */}
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-3 flex-shrink-0">
            <div className="flex gap-1">
              {['all', 'USD', 'KHR'].map(c => (
                <button
                  key={c}
                  onClick={() => setCurrFilter(c)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    currFilter === c ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {c === 'all' ? 'All' : c}
                </button>
              ))}
            </div>
            <div className="h-4 w-px bg-slate-200" />
            <button
              onClick={() => setLowStock(v => !v)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                lowStock ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              ⚠ Low Stock
            </button>
            <span className="ml-auto text-[11px] text-slate-400 font-mono">{displayed.length} products</span>
          </div>
          <div className="flex-1 overflow-x-auto overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider font-display">
                  <th className="px-6 py-3.5 w-12 text-center cursor-pointer select-none hover:text-slate-600" onClick={() => toggleSort('id')}>ID{si('id')}</th>
                  <th className="px-6 py-3.5 cursor-pointer select-none hover:text-slate-600" onClick={() => toggleSort('name')}>{labels.thName || 'Product Name'}{si('name')}</th>
                  <th className="px-6 py-3.5 cursor-pointer select-none hover:text-slate-600" onClick={() => toggleSort('barcode')}>{labels.thBarcode || 'Barcode Key'}{si('barcode')}</th>
                  <th className="px-6 py-3.5 text-center cursor-pointer select-none hover:text-slate-600" onClick={() => toggleSort('price')}>{labels.thPrice || 'Unit Price'}{si('price')}</th>
                  <th className="px-6 py-3.5 w-36 cursor-pointer select-none hover:text-slate-600" onClick={() => toggleSort('stock')}>{labels.thStock || 'Current Stock Level'}{si('stock')}</th>
                  <th className="px-6 py-3.5 text-right w-28">{labels.thActions || 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
                {paged.map((product) => {
                  const isEditing = editingId === product.id;
                  const isLowStock = product.stock <= 5;
                  
                  return (
                    <tr key={product.id} className={`hover:bg-slate-50/50 transition-colors ${isEditing ? 'bg-indigo-50/20' : ''}`}>
                      <td className="px-6 py-3 text-center text-xs font-mono font-bold text-slate-400">{product.id}</td>
                      
                      {/* Name Column Rendering */}
                      <td className="px-6 py-3">
                        {isEditing ? (
                          <input 
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                            className="p-1.5 border border-slate-200 rounded bg-white w-full max-w-xs font-display text-sm font-semibold"
                          />
                        ) : (
                          <span className="text-slate-900 font-bold font-display">{product.name}</span>
                        )}
                      </td>

                      {/* Barcode Column Rendering */}
                      <td className="px-6 py-3">
                        {isEditing ? (
                          <input 
                            type="text"
                            value={editForm.barcode}
                            onChange={(e) => setEditForm({...editForm, barcode: e.target.value})}
                            className="p-1.5 border border-slate-200 rounded bg-white w-full font-mono text-xs text-slate-600"
                          />
                        ) : (
                          <span className="font-mono text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-md font-bold">{product.barcode}</span>
                        )}
                      </td>

                      {/* Price Column */}
                      <td className="px-6 py-3 text-center">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5 justify-center">
                            <input
                              type="number"
                              step={editForm.currency === 'USD' ? '0.01' : '100'}
                              value={editForm.price}
                              onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                              className="p-1.5 border border-slate-200 rounded bg-white w-24 text-center font-semibold text-sm"
                            />
                            <select
                              value={editForm.currency}
                              onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })}
                              className="p-1.5 border border-slate-200 rounded bg-white text-xs font-bold text-slate-600"
                            >
                              <option value="USD">USD</option>
                              <option value="KHR">KHR</option>
                            </select>
                          </div>
                        ) : (
                          <div>
                            <span className="font-bold text-slate-800">
                              {product.currency === 'KHR'
                                ? `${parseFloat(product.price).toLocaleString()} ៛`
                                : `$${parseFloat(product.price).toFixed(2)}`}
                            </span>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {product.currency === 'KHR'
                                ? `≈ $${(parseFloat(product.price) / dynamicRate).toFixed(2)}`
                                : `≈ ${Math.round(parseFloat(product.price) * dynamicRate).toLocaleString()} ៛`}
                            </p>
                          </div>
                        )}
                      </td>

                      {/* Stock Inventory Controls Row Column */}
                      <td className="px-6 py-3">
                        {isEditing ? (
                          <input 
                            type="number"
                            value={editForm.stock}
                            onChange={(e) => setEditForm({...editForm, stock: e.target.value})}
                            className="p-1.5 border border-slate-200 rounded bg-white w-16 text-center font-bold text-sm"
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono ${isLowStock ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-700'}`}>
                              {product.stock}
                            </span>
                            {isLowStock && <span className="text-[11px] text-amber-600 font-bold font-display">{labels.needsRestock}</span>}
                          </div>
                        )}
                      </td>

                      {/* Control Actions Row Layout */}
                      <td className="px-6 py-3 text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-1.5">
                            <button onClick={() => handleSaveEdit(product.id)} className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold font-display cursor-pointer">{labels.saveBtn}</button>
                            <button onClick={() => setEditingId(null)} className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg text-xs font-bold font-display cursor-pointer">{labels.cancelBtn}</button>
                          </div>
                        ) : (
                          <button onClick={() => handleEditClick(product)} className="text-indigo-600 hover:text-indigo-900 text-xs font-bold bg-indigo-50/60 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition-colors font-display cursor-pointer">
                            {labels.editBtn}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>
      </div>

      {/* Pagination footer — always visible at the bottom */}
      {totalPages > 1 && (
        <div className="bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <span className="text-xs text-slate-400 font-medium">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, displayed.length)} of {displayed.length}
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

      {/* MODAL POPUP DIALOG: REGISTER NEW PRODUCT */}
      {showAddForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl max-w-md w-full overflow-hidden flex flex-col space-y-4 transform scale-100 transition-all">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800 uppercase tracking-wider font-display">
                {labels.registerNewProduct || 'Register New Product'}
              </h3>
              <button 
                onClick={() => setShowAddForm(false)} 
                className="text-slate-400 hover:text-slate-600 font-bold text-sm p-1 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleAddProductSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide font-display">{labels.itemName || 'Item Name'}</label>
                <input 
                  type="text"
                  required
                  placeholder={labels.placeholderItemName || "e.g. Baby Wipes"}
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                  className="w-full mt-1.5 p-2.5 border border-slate-200 bg-slate-50 rounded-lg text-sm font-medium focus:outline-none focus:border-indigo-500 font-display"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide font-display">{labels.barcodeString || 'Barcode String'}</label>
                <input 
                  type="text"
                  required
                  placeholder={labels.placeholderBarcode || "Scan or type code"}
                  value={newProduct.barcode}
                  onChange={(e) => setNewProduct({...newProduct, barcode: e.target.value})}
                  className="w-full mt-1.5 p-2.5 border border-slate-200 bg-slate-50 rounded-lg text-sm font-mono text-slate-700 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide font-display">{labels.retailPrice || 'Price'}</label>
                <div className="flex gap-2 mt-1.5">
                  <input
                    type="number"
                    step={newProduct.currency === 'USD' ? '0.01' : '100'}
                    placeholder={newProduct.currency === 'USD' ? '0.00' : '0'}
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                    className="flex-1 p-2.5 border border-slate-200 bg-slate-50 rounded-lg text-sm font-mono font-bold text-indigo-600 focus:outline-none focus:border-indigo-500"
                  />
                  <select
                    value={newProduct.currency}
                    onChange={(e) => setNewProduct({ ...newProduct, currency: e.target.value, price: '' })}
                    className="p-2.5 border border-slate-200 bg-slate-50 rounded-lg text-sm font-bold text-slate-600 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="USD">USD</option>
                    <option value="KHR">KHR</option>
                  </select>
                </div>
                {newProduct.price && (
                  <p className="text-[11px] text-slate-400 font-mono mt-1">{priceEquivalent(newProduct)}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide font-display">{labels.initialStock || 'Initial Stock Count'}</label>
                <input 
                  type="number"
                  placeholder="0"
                  value={newProduct.stock}
                  onChange={(e) => setNewProduct({...newProduct, stock: e.target.value})}
                  className="w-full mt-1.5 p-2.5 border border-slate-200 bg-slate-50 rounded-lg text-sm font-mono font-bold text-indigo-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-2 pt-2 justify-end border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  {labels.cancelBtn || 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-xs transition-colors font-display cursor-pointer"
                >
                  {labels.saveToDb || 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}