import React, { useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  Package,
  Scale,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  X,
  Layers,
  Sparkles,
} from 'lucide-react';
import type { Product, Alert } from '../types/index.js';

interface InventoryViewProps {
  products: Product[];
  alerts: Alert[];
  onCreateProduct: (product: Omit<Product, 'id' | 'created_at'>) => Promise<void>;
  onUpdateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
}

// Preset generated images for easy selection in modal
const PRESET_IMAGES = [
  {
    name: 'Organic Whole Milk Bottle',
    url: '/src/assets/images/shelf_prod_milk_1790616054203.jpg',
  },
  {
    name: 'Artisan Cold Brew Amber Glass',
    url: '/src/assets/images/shelf_prod_coffee_1790616067677.jpg',
  },
  {
    name: 'Extra Virgin Olive Oil Reserve',
    url: '/src/assets/images/shelf_prod_oil_1790616079016.jpg',
  },
  {
    name: 'Artisan Granola Crunch Box',
    url: '/src/assets/images/shelf_prod_cereal_1790616089979.jpg',
  },
];

export const InventoryView: React.FC<InventoryViewProps> = ({
  products,
  alerts,
  onCreateProduct,
  onUpdateProduct,
  onDeleteProduct,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  // Form states for Add Product
  const [formData, setFormData] = useState({
    name: '',
    category: 'Beverages',
    shelf_position: 'Shelf C-1',
    expected_weight_g: 500,
    min_threshold: 3,
    current_stock: 6,
    max_capacity: 12,
    image_url: PRESET_IMAGES[0].url,
  });

  const categories = ['all', ...Array.from(new Set(products.map((p) => p.category)))];

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.shelf_position.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onCreateProduct({
        name: formData.name.trim(),
        category: formData.category.trim(),
        shelf_position: formData.shelf_position.trim(),
        expected_weight_g: Number(formData.expected_weight_g),
        min_threshold: Number(formData.min_threshold),
        current_stock: Number(formData.current_stock),
        max_capacity: Number(formData.max_capacity),
        image_url: formData.image_url,
      });
      setIsAddModalOpen(false);
      // Reset form
      setFormData({
        name: '',
        category: 'Beverages',
        shelf_position: 'Shelf C-1',
        expected_weight_g: 500,
        min_threshold: 3,
        current_stock: 6,
        max_capacity: 12,
        image_url: PRESET_IMAGES[0].url,
      });
    } catch (err: any) {
      alert(`Error creating product: ${err.message}`);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    try {
      await onUpdateProduct(editingProduct.id, {
        name: editingProduct.name,
        category: editingProduct.category,
        shelf_position: editingProduct.shelf_position,
        expected_weight_g: Number(editingProduct.expected_weight_g),
        min_threshold: Number(editingProduct.min_threshold),
        current_stock: Number(editingProduct.current_stock),
        max_capacity: Number(editingProduct.max_capacity),
      });
      setEditingProduct(null);
    } catch (err: any) {
      alert(`Error updating product: ${err.message}`);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingProductId) return;
    try {
      await onDeleteProduct(deletingProductId);
      setDeletingProductId(null);
    } catch (err: any) {
      alert(`Error deleting product: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Inventory Management</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Registered products, physical shelf allocations, and load thresholds.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span>Add New Product</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or shelf..."
            className="w-full rounded-lg border border-slate-800 bg-slate-900/80 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1">
          <span className="text-xs text-slate-500 flex items-center gap-1 font-mono">
            <Filter className="h-3 w-3" /> Filter:
          </span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                selectedCategory === cat
                  ? 'bg-slate-800 text-cyan-400 border border-slate-700'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* High-Density Inventory Table */}
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-mono uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3 pl-4 pr-3">Product</th>
                <th className="py-3 px-3">Location / Shelf</th>
                <th className="py-3 px-3">Unit Weight</th>
                <th className="py-3 px-3">Stock Level</th>
                <th className="py-3 px-3">Alert Status</th>
                <th className="py-3 pr-4 pl-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No products found matching your search criteria.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const productAlerts = alerts.filter(
                    (a) => a.shelf_id === p.shelf_position && a.status === 'ACTIVE'
                  );
                  const isLow = p.current_stock <= p.min_threshold;
                  const stockPct = Math.round((p.current_stock / p.max_capacity) * 100);

                  return (
                    <tr key={p.id} className="hover:bg-slate-850/50 transition-colors">
                      {/* Product Media & Name */}
                      <td className="py-3 pl-4 pr-3">
                        <div className="flex items-center gap-3 font-sans">
                          <img
                            src={p.image_url}
                            alt={p.name}
                            referrerPolicy="no-referrer"
                            className="h-10 w-10 shrink-0 rounded-md border border-slate-700 object-cover bg-slate-950"
                          />
                          <div>
                            <div className="font-semibold text-white">{p.name}</div>
                            <div className="text-[11px] text-slate-500">{p.category}</div>
                          </div>
                        </div>
                      </td>

                      {/* Location / Shelf ID */}
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 rounded bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 text-cyan-300 font-semibold text-[11px]">
                          <MapPin className="h-3 w-3" />
                          {p.shelf_position}
                        </span>
                      </td>

                      {/* Expected Unit Weight */}
                      <td className="py-3 px-3 text-slate-300 tabular-nums">
                        {p.expected_weight_g} g
                      </td>

                      {/* Current Stock Level */}
                      <td className="py-3 px-3">
                        <div className="w-36 space-y-1">
                          <div className="flex items-center justify-between text-[11px] tabular-nums">
                            <span className={isLow ? 'text-amber-400 font-bold' : 'text-slate-200'}>
                              {p.current_stock} / {p.max_capacity}
                            </span>
                            <span className="text-slate-500">{stockPct}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full ${
                                isLow ? 'bg-amber-400' : 'bg-cyan-500'
                              }`}
                              style={{ width: `${Math.min(100, stockPct)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Alert Status */}
                      <td className="py-3 px-3">
                        {productAlerts.length > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded bg-rose-950/60 border border-rose-500/40 px-2 py-0.5 text-rose-300 text-[11px]">
                            <AlertTriangle className="h-3 w-3" />
                            {productAlerts[0].alert_type}
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-950/60 border border-amber-500/40 px-2 py-0.5 text-amber-300 text-[11px]">
                            <AlertTriangle className="h-3 w-3" />
                            LOW STOCK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px]">
                            <CheckCircle2 className="h-3 w-3" />
                            NOMINAL
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 pr-4 pl-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingProduct(p)}
                            className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                            title="Edit product parameters"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingProductId(p.id)}
                            className="rounded p-1.5 text-slate-400 hover:bg-rose-950/50 hover:text-rose-400 transition-colors"
                            title="Delete product"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD PRODUCT MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Add New Smart Shelf Product</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Pure Coconut Water 500ml"
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Category</label>
                  <input
                    type="text"
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Shelf Location ID
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.shelf_position}
                    onChange={(e) => setFormData({ ...formData, shelf_position: e.target.value })}
                    placeholder="e.g. Shelf C-1"
                    className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Unit Weight (g)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.expected_weight_g}
                    onChange={(e) =>
                      setFormData({ ...formData, expected_weight_g: Number(e.target.value) })
                    }
                    className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Initial Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.current_stock}
                    onChange={(e) =>
                      setFormData({ ...formData, current_stock: Number(e.target.value) })
                    }
                    className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Min Alert Threshold
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.min_threshold}
                    onChange={(e) =>
                      setFormData({ ...formData, min_threshold: Number(e.target.value) })
                    }
                    className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Product Photo Selector */}
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  Select Product Visual Asset
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_IMAGES.map((img) => (
                    <button
                      type="button"
                      key={img.url}
                      onClick={() => setFormData({ ...formData, image_url: img.url })}
                      className={`relative rounded-lg overflow-hidden border p-0.5 transition-all ${
                        formData.image_url === img.url
                          ? 'border-cyan-400 ring-2 ring-cyan-400/30'
                          : 'border-slate-800 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={img.url}
                        alt={img.name}
                        referrerPolicy="no-referrer"
                        className="h-16 w-full object-cover rounded"
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-cyan-500 hover:bg-cyan-400 px-4 py-2 font-semibold text-slate-950 transition-colors"
                >
                  Save to Smart Database
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PRODUCT MODAL */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Edit Shelf Parameters</h3>
              <button
                onClick={() => setEditingProduct(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  value={editingProduct.name}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, name: e.target.value })
                  }
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Shelf Location
                  </label>
                  <input
                    type="text"
                    required
                    value={editingProduct.shelf_position}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, shelf_position: e.target.value })
                    }
                    className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Unit Weight (g)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editingProduct.expected_weight_g}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        expected_weight_g: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Current Units
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editingProduct.current_stock}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        current_stock: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Min Stock Threshold
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editingProduct.min_threshold}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        min_threshold: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="rounded-lg px-4 py-2 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-cyan-500 hover:bg-cyan-400 px-4 py-2 font-semibold text-slate-950 transition-colors"
                >
                  Update Parameters
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION PROMPT */}
      {deletingProductId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-xl border border-rose-500/40 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400 mb-2">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-base font-bold text-white">Confirm Product Deletion</h3>
            </div>
            <p className="text-xs text-slate-300 mt-2">
              Are you sure you want to remove this product and its shelf allocation? All associated sensor
              logs and active alerts will be removed from the database.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingProductId(null)}
                className="rounded-lg px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="rounded-lg bg-rose-500 hover:bg-rose-400 px-4 py-2 text-xs font-semibold text-white transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
