import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  productName: string;
}

export const DeleteProductDialog: React.FC<Props> = ({ isOpen, onConfirm, onCancel, productName }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-[#0a0a0a] border border-white/10 p-8 rounded-xl max-w-md w-full"
          >
            <h2 className="text-xl font-light text-white mb-4">Archive Product</h2>
            <p className="text-white/60 mb-8">Are you sure you want to archive <span className="text-white font-medium">{productName}</span>? This product will be hidden from the storefront.</p>
            <div className="flex justify-end gap-4">
              <button onClick={onCancel} className="px-6 py-2 text-white/40 hover:text-white transition-colors">Cancel</button>
              <button onClick={onConfirm} className="px-6 py-2 bg-red-900/50 hover:bg-red-900 text-red-200 rounded-lg transition-colors">Archive</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
