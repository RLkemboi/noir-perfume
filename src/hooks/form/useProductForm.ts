import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { productFormSchema, type ProductFormValues } from '@/schemas/productForm.schema';
import type { Product } from '@/../server/types';

type ProductFormInput = z.input<typeof productFormSchema>;

export const useProductForm = (initialData?: Product) => {
  const form = useForm<ProductFormInput, unknown, ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: initialData || {
      name: '',
      slug: '',
      brand: '',
      description: '',
      price: 0,
      stockQuantity: 0,
      sku: '',
      category: '',
      gender: 'unisex',
      notes: { top: [], middle: [], base: [] },
      tags: [],
      sizes: [],
      status: 'draft',
      visibility: 'hidden',
      isFeatured: false,
      isNewArrival: false,
      isBestSeller: false,
      images: [],
    }
  });

  return {
    form,
    isEditMode: !!initialData
  };
};
