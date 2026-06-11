import { useFormContext } from 'react-hook-form';

export const ProductBasicInfoSection = () => {
  const { register } = useFormContext();

  return (
    <div className="bg-[#0a0a0a] border border-white/10 p-6 rounded-xl space-y-4">
      <h3 className="text-lg font-light text-white">Basic Information</h3>
      <input {...register('name')} placeholder="Perfume Name" className="w-full bg-white/5 border border-white/10 p-2 rounded" />
      <input {...register('brand')} placeholder="Brand" className="w-full bg-white/5 border border-white/10 p-2 rounded" />
      <div className="flex gap-4">
         <select {...register('gender')} className="flex-1 bg-white/5 border border-white/10 p-2 rounded text-white">
            <option value="masculine">Masculine</option>
            <option value="feminine">Feminine</option>
            <option value="unisex">Unisex</option>
         </select>
         <input {...register('category')} placeholder="Category" className="flex-1 bg-white/5 border border-white/10 p-2 rounded" />
      </div>
    </div>
  );
};
