import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { productService, type ProductAdminQuery } from '../services/product.service';

export const useProducts = (query: ProductAdminQuery) => {
  const queryClient = useQueryClient();

  const queryResult = useQuery({
    queryKey: ['admin-products', query],
    queryFn: () => productService.fetchAdminProducts(query),
  });

  const invalidateProducts = () => queryClient.invalidateQueries({ queryKey: ['admin-products'] });

  const archiveMutation = useMutation({
    mutationFn: productService.archiveProduct,
    onSuccess: invalidateProducts,
  });

  const duplicateMutation = useMutation({
    mutationFn: productService.duplicateProduct,
    onSuccess: invalidateProducts,
  });

  const inventoryMutation = useMutation({
    mutationFn: ({ id, delta, note }: { id: string; delta: number; note?: string }) =>
      productService.adjustInventory(id, delta, note),
    onSuccess: invalidateProducts,
  });

  return {
    ...queryResult,
    archiveProduct: archiveMutation.mutateAsync,
    duplicateProduct: duplicateMutation.mutateAsync,
    adjustInventory: inventoryMutation.mutateAsync,
  };
};
