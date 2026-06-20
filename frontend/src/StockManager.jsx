import React, { useState, useEffect } from 'react';

export default function StockManager({ onBackToRegister }) {
  const [products, setProducts] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', barcode: '', price_usd: '', stock: '' });
  
  // State for creating a new product row entry
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', barcode: '', price_usd: '', stock: '' });

  const BACKEND_URL = 'http://localhost:5050';

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
        fetchInventory(); // Refresh view grid layout
      } else {
        alert('Failed to update product details.');
      }
    } catch (err) {
      console.error('Error committing inline updates:', err);
    }
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.barcode || !newProduct.price_usd) {
      alert('Please fill out all mandatory identity fields');
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
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 antialiased">
      {/* Mini Top Header Grid Row layout */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-xs">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBackToRegister}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-semibold transition-colors text-slate-600 flex items-center gap-1"
          >
            ⬅️ Register Terminal
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Inventory Stock Ledger</h1>
            <p className="text-xs font-semibold text-indigo-600 tracking-wider uppercase">Audit Room</p>
          </div>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-xs transition-colors"
        >
          {showAddForm ? 'Close Drawer' : '➕ Register New Product'}
        </button>
      </header>

      <div className="flex-1 p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Dropdown creation card block drawer */}
        {showAddForm && (
          <form onSubmit={handleCreateProduct} className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Item Name</label>
              <input 
                type="text" 
                value={newProduct.name} 
                onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                placeholder="e.g. Huggies Diapers M-Size"
                className="w-full mt-1.5 p-2.5 border border-slate-200 bg-slate-50 rounded-lg text-sm font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Barcode String</label>
              <input 
                type="text" 
                value={newProduct.barcode} 
                onChange={(e) => setNewProduct({...newProduct, barcode: e.target.value})}
                placeholder="Scan or type package barcode"
                className="w-full mt-1.5 p-2.5 border border-slate-200 bg-slate-50 rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Retail Price (USD)</label>
              <input 
                type="number" step="0.01"
                value={newProduct.price_usd} 
                onChange={(e) => setNewProduct({...newProduct, price_usd: e.target.value})}
                placeholder="0.00"
                className="w-full mt-1.5 p-2.5 border border-slate-200 bg-slate-50 rounded-lg text-sm font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Initial Stock Count</label>
              <input 
                type="number" 
                value={newProduct.stock} 
                onChange={(e) => setNewProduct({...newProduct, stock: e.target.value})}
                placeholder="0"
                className="w-full mt-1.5 p-2.5 border border-slate-200 bg-slate-50 rounded-lg text-sm font-bold"
              />
            </div>
            <div className="md:col-span-4 flex justify-end">
              <button type="submit" className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm">
                Save Product Card to Database
              </button>
            </div>
          </form>
        )}

        {/* Master Stock Table Spreadsheet Layout Container */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Product Name</th>
                  <th className="px-6 py-4">Barcode Key</th>
                  <th className="px-6 py-4">Unit Price</th>
                  <th className="px-6 py-4">Current Stock Level</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
                {products.map((product) => {
                  const isEditing = editingId === product.id;
                  const isLowStock = product.stock <= 5;

                  return (
                    <tr key={product.id} className={`hover:bg-slate-50/80 transition-colors ${isLowStock ? 'bg-amber-50/30' : ''}`}>
                      <td className="px-6 py-4">
                        {isEditing ? (
                          <input 
                            type="text" 
                            value={editForm.name} 
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="p-1.5 border border-slate-300 rounded-md w-full bg-white font-medium text-sm"
                          />
                        ) : (
                          <span className="font-semibold text-slate-900">{product.name}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">
                        {isEditing ? (
                          <input 
                            type="text" 
                            value={editForm.barcode} 
                            onChange={(e) => setEditForm({ ...editForm, barcode: e.target.value })}
                            className="p-1.5 border border-slate-300 rounded-md w-full bg-white text-xs"
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
                          `$${Number(product.price_usd).toFixed(2)}`
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {isEditing ? (
                          <input 
                            type="number" 
                            value={editForm.stock} 
                            onChange={(e) => setEditForm({ ...editForm, stock: e.target.value })}
                            className="p-1.5 border border-slate-300 rounded-md w-20 bg-white"
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${isLowStock ? 'bg-rose-100 text-rose-700 font-black' : 'bg-slate-100 text-slate-700'}`}>
                              {product.stock} units
                            </span>
                            {isLowStock && <span className="text-xs text-amber-600 font-semibold">⚠️ Needs Restock</span>}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-2">
                            <button onClick={() => handleSaveEdit(product.id)} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold">Save</button>
                            <button onClick={() => setEditingId(null)} className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-md text-xs font-bold">Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => handleEditClick(product)} className="text-indigo-600 hover:text-indigo-900 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors">
                            ✏️ Edit Record
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