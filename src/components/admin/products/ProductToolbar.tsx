import React from 'react';

interface Props {
  search: string;
  onSearchChange: (value: string) => void;
  onAdd: () => void;
}

export const ProductToolbar: React.FC<Props> = ({ search, onSearchChange, onAdd }) => {
  return (
    <div className="flex flex-col md:flex-row justify-between gap-4">
      <input 
        type="text"
        placeholder="Search perfumes..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="bg-white/5 border border-white/10 px-4 py-2 rounded-lg text-white placeholder-white/20 outline-none focus:border-white/30 transition-colors w-full md:w-80"
      />
      <button 
        onClick={onAdd}
        className="bg-white text-black px-6 py-2 hover:bg-white/90 transition-colors uppercase text-xs tracking-[0.2em] font-medium"
      >
        Add New Perfume
      </button>
    </div>
  );
};
