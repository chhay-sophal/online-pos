import React, { useState, useEffect } from 'react';
import { translations as t } from './locales';

export default function StockManager({ onBackToRegister, currentLocale, mainCurrency = 'USD', dynamicRate = 4100 }) {
  const [products, setProducts] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', barcode: '', price_usd: '', price_khr: '', stock: '' });
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', barcode: '', price_usd: '', price_khr: '', stock: '' });

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
      price_usd: product.price_usd || '',
      price_khr: product.price_khr || '',
      stock: product.stock
    });
  };

  // Automated Cross-Calculation Handlers for Form Mutations
  const handleFormUsdChange = (val, isNewForm) => {
    if (val === '') {
      const resetValues = { price_usd: '', price_khr: '' };
      isNewForm ? setNewProduct(prev => ({ ...prev, ...resetValues })) : setEditForm(prev => ({ ...prev, ...resetValues }));
      return;
    }
    const calculatedKhr = Math.round((parseFloat(val) || 0) * dynamicRate);
    const updatedValues = { price_usd: val, price_khr: calculatedKhr > 0 ? String(calculatedKhr) : '' };
    isNewForm ? setNewProduct(prev => ({ ...prev, ...updatedValues })) : setEditForm(prev => ({ ...prev, ...updatedValues }));
  };

  const handleFormKhrChange = (val, isNewForm) => {
    if (val === '') {
      const resetValues = { price_usd: '', price_khr: '' };
      isNewForm ? setNewProduct(prev => ({ ...prev, ...resetValues })) : setEditForm(prev => ({ ...prev, ...resetValues }));
      return;
    }
    const calculatedUsd = ((parseInt(val, 10) || 0) / dynamicRate).toFixed(2);
    const updatedValues = { price_khr: val, price_usd: parseFloat(calculatedUsd) > 0 ? calculatedUsd : '' };
    isNewForm ? setNewProduct(prev => ({ ...prev, ...updatedValues })) : setEditForm(prev => ({ ...prev, ...updatedValues }));
  };

  const handleSaveEdit = async (id) => {
    if (!editForm.name || !editForm.barcode || (!editForm.price_usd && !editForm.price_khr)) {
      alert(labels.alertMandatory || 'Please fill out all mandatory fields (requires at least one price).');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          barcode: editForm.barcode,
          price_usd: editForm.price_usd ? parseFloat(editForm.price_usd) : 0.00,
          price_khr: editForm.price_khr ? parseInt(editForm.price_khr, 10) : 0,
          stock: parseInt(editForm.stock, 10) || 0
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
    if (!newProduct.name || !newProduct.barcode || (!newProduct.price_usd && !newProduct.price_khr)) {
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
          price_usd: newProduct.price_usd ? parseFloat(newProduct.price_usd) : 0.00,
          price_khr: newProduct.price_khr ? parseInt(newProduct.price_khr, 10) : 0,
          stock: parseInt(newProduct.stock, 10) || 0
        }),
      });

      if (response.ok) {
        setNewProduct({ name: '', barcode: '', price_usd: '', price_khr: '', stock: '' });
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 antialiased overflow-hidden">
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

        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-sm transition-all flex items-center gap-2 font-display cursor-pointer active:scale-95"
        >
          {labels.registerNewProduct || '➕ Register New Product'}
        </button>
      </header>

      <div className="flex-1 p-6 max-w-6xl mx-auto w-full overflow-hidden flex flex-col gap-6">
        {/* Data Matrix Grid Table Wrapper */}
        <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col">
          <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[calc(100vh-140px)]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider font-display">
                  <th className="px-6 py-3.5 w-12 text-center">ID</th>
                  <th className="px-6 py-3.5">{labels.thName || 'Product Name'}</th>
                  <th className="px-6 py-3.5">{labels.thBarcode || 'Barcode Key'}</th>
                  <th className="px-6 py-3.5 text-center">{labels.thPrice || 'Unit Price (USD)'}</th>
                  <th className="px-6 py-3.5 text-center">Unit Price (KHR)</th>
                  <th className="px-6 py-3.5 w-36">{labels.thStock || 'Current Stock Level'}</th>
                  <th className="px-6 py-3.5 text-right w-28">{labels.thActions || 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
                {products.map((product) => {
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

                      {/* Price USD Column Rendering */}
                      <td className="px-6 py-3 text-center">
                        {isEditing ? (
                          <input 
                            type="number"
                            step="0.01"
                            value={editForm.price_usd}
                            onChange={(e) => handleFormUsdChange(e.target.value, false)}
                            className="p-1.5 border border-slate-200 rounded bg-white w-20 text-center font-semibold text-sm"
                          />
                        ) : (
                          <span className="font-bold text-slate-800">${(parseFloat(product.price_usd) || 0).toFixed(2)}</span>
                        )}
                      </td>

                      {/* Price KHR Column Rendering */}
                      <td className="px-6 py-3 text-center">
                        {isEditing ? (
                          <input 
                            type="number"
                            value={editForm.price_khr}
                            onChange={(e) => handleFormKhrChange(e.target.value, false)}
                            className="p-1.5 border border-slate-200 rounded bg-white w-24 text-center font-mono font-bold text-indigo-600 text-sm"
                          />
                        ) : (
                          <span className="font-mono font-bold text-indigo-600">{(parseInt(product.price_khr, 10) || 0).toLocaleString()} ៛</span>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide font-display">{labels.retailPrice || 'Price'} (KHR)</label>
                  <input 
                    type="number"
                    step="100"
                    placeholder="0"
                    value={newProduct.price_khr}
                    onChange={(e) => handleFormKhrChange(e.target.value, true)}
                    className="w-full mt-1.5 p-2.5 border border-slate-200 bg-slate-50 rounded-lg text-sm font-mono font-bold text-indigo-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide font-display">{labels.retailPrice || 'Price'} (USD)</label>
                  <input 
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newProduct.price_usd}
                    onChange={(e) => handleFormUsdChange(e.target.value, true)}
                    className="w-full mt-1.5 p-2.5 border border-slate-200 bg-slate-50 rounded-lg text-sm font-mono font-bold text-indigo-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
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