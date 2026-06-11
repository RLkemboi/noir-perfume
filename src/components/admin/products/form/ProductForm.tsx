import React from 'react';
import { FormProvider } from 'react-hook-form';
import { toast } from 'sonner';
import { useProductForm } from '@/hooks/form/useProductForm';
import { ProductBasicInfoSection } from './ProductBasicInfoSection';
import { ProductImagesSection } from './ProductImagesSection';
import { productService } from '@/services/product.service';
import type { ProductFormValues } from '@/schemas/productForm.schema';
import type { Product } from '@/../server/types';

export const ProductForm: React.FC<{ initialData?: Product; onSuccess?: () => void }> = ({ initialData, onSuccess }) => {
  const { form, isEditMode } = useProductForm(initialData);

  const onSubmit = async (data: ProductFormValues) => {
    try {
      const payload = { ...data, id: initialData?.id };
      await productService.saveProduct(payload);
      toast.success(isEditMode ? 'Product updated successfully' : 'Product created successfully');
      onSuccess?.();
    } catch (error) {
      console.error(error);
      toast.error('Failed to save product');
    }
  };

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-4xl mx-auto p-8">
        <ProductBasicInfoSection />
        <ProductImagesSection />
        
        <div className="sticky bottom-0 bg-[#0a0a0a]/80 backdrop-blur p-4 flex justify-end gap-4 border-t border-white/10">
          <button type="button" className="px-6 py-2 text-white/40">Save Draft</button>
          <button type="submit" className="px-6 py-2 bg-white text-black rounded" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Saving...' : (isEditMode ? 'Update Perfume' : 'Publish Perfume')}
          </button>
        </div>
      </form>
    </FormProvider>
  );
};
