import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { productService } from "@/services/product.service";
import { products as seededProducts } from "@/data";
import { mapManagedProductToStorefront, type StorefrontProduct } from "@/utils/storefrontProductAdapter";
import { filterDefaultCatalog } from "@/utils/productRanking";

function collectBrands(items: StorefrontProduct[]): string[] {
  return [...new Set(items.map((item) => item.brand))];
}

function collectCollections(items: StorefrontProduct[]): Array<NonNullable<StorefrontProduct["collection"]>> {
  return [
    ...new Set(
      items
        .map((item) => item.collection)
        .filter((value): value is NonNullable<StorefrontProduct["collection"]> => value != null)
    ),
  ];
}

export function useStorefrontProducts() {
  const query = useQuery({
    queryKey: ["storefront-products"],
    queryFn: () => productService.fetchStorefrontProducts(),
    staleTime: 30_000,
  });

  const mappedProducts = useMemo<StorefrontProduct[]>(() => {
    const items =
      !query.data || query.data.length === 0 ? seededProducts : query.data.map(mapManagedProductToStorefront);
    return filterDefaultCatalog(items);
  }, [query.data]);

  const brands = useMemo(() => collectBrands(mappedProducts), [mappedProducts]);
  const collections = useMemo(() => collectCollections(mappedProducts), [mappedProducts]);

  return {
    ...query,
    products: mappedProducts,
    brands,
    collections,
  };
}
