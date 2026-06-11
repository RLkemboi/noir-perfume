import React from 'react';
import type { Product } from '../../../../server/types';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  products: Product[];
  onEdit: (p: Product) => void;
  onArchive: (id: string) => void;
}

export const ProductTable: React.FC<Props> = ({ products, onEdit, onArchive }) => {
  return (
    <div className="w-full">
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-white/40 border-b border-white/10 uppercase text-xs tracking-widest font-light">
              <th className="py-6 px-4">Product</th>
              <th className="py-6 px-4">Price</th>
              <th className="py-6 px-4">Stock</th>
              <th className="py-6 px-4">Status</th>
              <th className="py-6 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {products.map((product) => (
                <motion.tr 
                  key={product.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors"
                >
                  <td className="py-6 px-4 font-light text-white">{product.name}</td>
                  <td className="py-6 px-4 font-light text-white/60">${product.price}</td>
                  <td className="py-6 px-4 font-light text-white/60">{product.stockQuantity}</td>
                  <td className="py-6 px-4">
                    <span className={`px-2 py-1 text-[10px] uppercase rounded-full ${product.status === 'published' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-amber-900/30 text-amber-400'}`}>
                      {product.status}
                    </span>
                  </td>
                  <td className="py-6 px-4 text-right space-x-4">
                    <button onClick={() => onEdit(product)} className="text-white/40 hover:text-white transition-colors">Edit</button>
                    <button onClick={() => onArchive(product.id)} className="text-white/40 hover:text-red-400 transition-colors">Archive</button>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {products.map((product) => (
          <div key={product.id} className="bg-white/5 p-4 rounded-lg border border-white/10">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-white font-medium">{product.name}</h3>
                <p className="text-white/40 text-sm">{product.brand}</p>
              </div>
              <span className={`px-2 py-1 text-[10px] uppercase rounded-full ${product.status === 'published' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-amber-900/30 text-amber-400'}`}>
                {product.status}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-white/60">${product.price} • {product.stockQuantity} left</span>
              <div className="space-x-4">
                <button onClick={() => onEdit(product)} className="text-white/40 hover:text-white">Edit</button>
                <button onClick={() => onArchive(product.id)} className="text-white/40 hover:text-red-400">Archive</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
