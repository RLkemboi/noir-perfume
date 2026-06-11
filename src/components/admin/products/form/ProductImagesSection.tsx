export const ProductImagesSection = () => {
  return (
    <div className="bg-[#0a0a0a] border border-white/10 p-6 rounded-xl space-y-4">
      <h3 className="text-lg font-light text-white">Media</h3>
      <div className="border-2 border-dashed border-white/10 p-8 rounded-lg flex flex-col items-center justify-center text-white/20 hover:border-white/30 transition-colors cursor-pointer">
        <p>Drag & Drop Images</p>
        <p className="text-xs">Supports JPG, PNG (Max 5MB)</p>
      </div>
      <div className="grid grid-cols-4 gap-4 mt-4">
        {/* Image Previews Go Here */}
      </div>
    </div>
  );
};
