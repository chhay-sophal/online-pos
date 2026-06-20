import React, { useState, useEffect } from 'react';
import { translations as t } from './locales';

export default function StockManager({ onBackToRegister, currentLocale, mainCurrency = 'USD', dynamicRate = 4100 }) {
  const [products, setProducts] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', barcode: '', price_usd: '', stock: '' });
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', barcode: '', price_usd: '', stock: '' });

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
      price_usd: product.price_usd,
      stock: product.stock
    });
  };

  const handleSaveEdit = async (id) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (response.ok) {
        setEditingId(null);
        fetchInventory(); 
      } else {
        alert(labels.alertUpdateFail);
      }
    } catch (err) {
      console.error('Error committing inline updates:', err);
    }
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.barcode || !newProduct.price_usd) {
      alert(labels.alertMandatory);
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProduct),
      });

      if (response.ok) {
        setNewProduct({ name: '', barcode: '', price_usd: '', stock: '' });
        setShowAddForm(false);
        fetchInventory();
      }
    } catch (err) {
      console.error('Error adding fresh barcode SKU entry:', err);
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-50 flex flex-col font-sans text-slate-900 antialiased">
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex justify-between items-center shadow-xs flex-shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBackToRegister}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors text-slate-600 flex items-center gap-1 font-display"
          >
            ⬅️ {labels.backBtn}
          </button>
          <div className="h-6 w-px bg-slate-200"></div>
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight font-display">{labels.title}</h1>
            <p className="text-[10px] font-bold text-indigo-600 tracking-wider uppercase">{labels.subtitle}</p>
          </div>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors font-display"
        >
          {showAddForm ? labels.closeDrawer : labels.registerNew}
        </button>
      </header>

      <div className="flex-1 p-5 max-w-6xl mx-auto w-full flex flex-col gap-4 overflow-hidden">
        {showAddForm && (
          <form onSubmit={handleCreateProduct} className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs grid grid-cols-1 md:grid-cols-4 gap-4 items-end flex-shrink-0 animate-fadeIn">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide font-display">{labels.itemName}</label>
              <input 
                type="text" 
                value={newProduct.name} 
                onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                placeholder="e.g. Huggies Diapers M-Size"
                className="w-full mt-1.5 h-10 px-3 border border-slate-200 bg-slate-50 rounded-xl text-sm font-medium focus:bg-white focus:outline-hidden focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide font-display">{labels.barcodeStr}</label>
              <input 
                type="text" 
                value={newProduct.barcode} 
                onChange={(e) => setNewProduct({...newProduct, barcode: e.target.value})}
                placeholder="Scan or type package barcode"
                onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                className="w-full mt-1.5 h-10 px-3 border border-slate-200 bg-slate-50 rounded-xl text-sm font-mono focus:bg-white focus:outline-hidden focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide font-display">{labels.retailPrice}</label>
              <input 
                type="number" step="0.01"
                value={newProduct.price_usd} 
                onChange={(e) => setNewProduct({...newProduct, price_usd: e.target.value})}
                placeholder="0.00"
                className="w-full mt-1.5 h-10 px-3 border border-slate-200 bg-slate-50 rounded-xl text-sm font-bold font-mono focus:bg-white focus:outline-hidden focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide font-display">{labels.initialStock}</label>
              <input 
                type="number" 
                value={newProduct.stock} 
                onChange={(e) => setNewProduct({...newProduct, stock: e.target.value})}
                placeholder="0"
                className="w-full mt-1.5 h-10 px-3 border border-slate-200 bg-slate-50 rounded-xl text-sm font-bold font-mono focus:bg-white focus:outline-hidden focus:border-indigo-500"
              />
            </div>
            <div className="md:col-span-4 flex justify-end">
              <button type="submit" className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs font-display">
                {labels.saveToDb}
              </button>
            </div>
          </form>
        )}

        {/* Master Stock Table Grid */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs flex-1 flex flex-col overflow-hidden">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse table-fixed">
              <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider font-display">
                <tr>
                  <th className="px-6 py-3.5 w-2/5">{labels.thName}</th>
                  <th className="px-6 py-3.5 w-1/5">{labels.thBarcode}</th>
                  <th className="px-6 py-3.5 w-1/6">{labels.thPrice}</th>
                  <th className="px-6 py-3.5 w-1/5">{labels.thStock}</th>
                  <th className="px-6 py-3.5 text-right w-24">{labels.thActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700 overflow-y-auto">
                {products.map((product) => {
                  const isEditing = editingId === product.id;
                  const isLowStock = product.stock <= 5;

                  return (
                    <tr key={product.id} className={`hover:bg-slate-50/60 transition-colors ${isLowStock ? 'bg-amber-50/20' : ''}`}>
                      <td className="px-6 py-3 truncate">
                        {isEditing ? (
                          <input 
                            type="text" 
                            value={editForm.name} 
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="h-9 px-2.5 border border-slate-200 focus:border-indigo-500 focus:outline-hidden rounded-lg w-full bg-white font-semibold text-sm"
                          />
                        ) : (
                          <span className="font-bold text-slate-900">{product.name}</span>
                        )}
                      </td>
                      <td className="px-6 py-3 font-mono text-xs text-slate-400 truncate">
                        {isEditing ? (
                          <input 
                            type="text" 
                            value={editForm.barcode} 
                            onChange={(e) => setEditForm({ ...editForm, barcode: e.target.value })}
                            onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                            className="h-9 px-2.5 border border-slate-200 focus:border-indigo-500 focus:outline-hidden rounded-lg w-full bg-white text-xs font-mono"
                          />
                        ) : (
                          product.barcode
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-900 font-bold">
                        {isEditing ? (
                          <input 
                            type="number" step="0.01"
                            value={editForm.price_usd} 
                            onChange={(e) => setEditForm({ ...editForm, price_usd: e.target.value })}
                            className="p-1.5 border border-slate-300 rounded-md w-24 bg-white"
                          />
                        ) : (
                          mainCurrency === 'USD' 
                            ? `$${Number(product.price_usd).toFixed(2)}` 
                            : `${Math.round(Number(product.price_usd) * dynamicRate).toLocaleString()} ៛`
                        )}
                      </td>
                      <td className="px-6 py-3">
                        {isEditing ? (
                          <input 
                            type="number" 
                            value={editForm.stock} 
                            onChange={(e) => setEditForm({ ...editForm, stock: e.target.value })}
                            className="h-9 px-2.5 border border-slate-200 focus:border-indigo-500 focus:outline-hidden rounded-lg w-20 bg-white font-mono"
                          />
                        ) : (
                          <div className="flex items-center gap-2.5">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono ${isLowStock ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'}`}>
                              {product.stock} {labels.units}
                            </span>
                            {isLowStock && <span className="text-[11px] text-amber-600 font-bold font-display">{labels.needsRestock}</span>}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-1.5">
                            <button onClick={() => handleSaveEdit(product.id)} className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold font-display">{labels.saveBtn}</button>
                            <button onClick={() => setEditingId(null)} className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg text-xs font-bold font-display">{labels.cancelBtn}</button>
                          </div>
                        ) : (
                          <button onClick={() => handleEditClick(product)} className="text-indigo-600 hover:text-indigo-900 text-xs font-bold bg-indigo-50/60 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition-colors font-display">
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
    </div>
  );
}