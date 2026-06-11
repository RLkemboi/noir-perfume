import type { Product, ProductImage } from '@/../server/types';
import { auth } from '../lib/firebase';

// The API assigns image ids server-side, so writes may omit them.
export type ProductWritePayload = Omit<Partial<Product>, 'images'> & {
  images?: Array<Omit<ProductImage, 'id'> & { id?: string }>;
};

const API_BASE = '/api/products';
const AUTH_WAIT_TIMEOUT_MS = 8000;

export interface ProductAdminResponse {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
  lowStockCount: number;
}

export interface ProductAdminQuery {
  search?: string;
  status?: string;
  visibility?: string;
  collection?: string;
  page?: number;
  pageSize?: number;
}

function parseResponseError(defaultMessage: string, payload: unknown): Error {
  if (payload && typeof payload === 'object') {
    const message = Reflect.get(payload, 'message');
    if (typeof message === 'string' && message.trim()) {
      return new Error(message);
    }
  }
  return new Error(defaultMessage);
}

const getAuthToken = async (): Promise<string> => {
  if (!auth) {
    throw new Error('Authentication is not configured for this environment.');
  }
  const firebaseAuth = auth;

  if (firebaseAuth.currentUser) {
    return firebaseAuth.currentUser.getIdToken();
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      unsubscribe();
      reject(new Error('Authentication timed out. Please sign in again.'));
    }, AUTH_WAIT_TIMEOUT_MS);

    const unsubscribe = firebaseAuth.onIdTokenChanged((user) => {
      if (settled) return;
      if (!user) return;
      settled = true;
      window.clearTimeout(timeout);
      unsubscribe();
      user.getIdToken().then(resolve).catch(reject);
    });
  });
};

const getAuthHeaders = async (): Promise<HeadersInit> => {
  const token = await getAuthToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

export const productService = {
  fetchAdminProducts: async (query: ProductAdminQuery = {}): Promise<ProductAdminResponse> => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value != null && value !== '') params.set(key, String(value));
    });
    const response = await fetch(`${API_BASE}/admin?${params.toString()}`, {
      headers: await getAuthHeaders()
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw parseResponseError('Failed to fetch products', payload);
    }
    return response.json();
  },

  createProduct: async (product: ProductWritePayload): Promise<Product> => {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(product)
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw parseResponseError('Failed to create product', payload);
    }
    return response.json();
  },

  updateProduct: async (id: string, product: ProductWritePayload): Promise<Product> => {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(product)
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw parseResponseError('Failed to update product', payload);
    }
    return response.json();
  },

  saveProduct: async (product: ProductWritePayload & { id?: string }): Promise<Product> => {
    if (!product.id) {
      return productService.createProduct(product);
    }
    return productService.updateProduct(product.id, product);
  },

  fetchStorefrontProducts: async (): Promise<Product[]> => {
    const response = await fetch(API_BASE);
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw parseResponseError('Failed to fetch products', payload);
    }
    const data = await response.json();
    return Array.isArray(data?.products) ? (data.products as Product[]) : [];
  },

  fetchProductById: async (id: string): Promise<Product> => {
    const response = await fetch(`${API_BASE}/${id}`);
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw parseResponseError('Failed to fetch product', payload);
    }
    const data = await response.json();
    if (!data?.product) {
      throw new Error('Product not found');
    }
    return data.product as Product;
  },

  updateProductStatus: async (id: string, status: Product['status']): Promise<Product> => {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ status })
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw parseResponseError('Failed to update product status', payload);
    }
    return response.json();
  },

  archiveProduct: async (id: string): Promise<Product> => {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
      headers: await getAuthHeaders()
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw parseResponseError('Failed to archive product', payload);
    }
    return response.json();
  },

  duplicateProduct: async (id: string): Promise<Product> => {
    const response = await fetch(`${API_BASE}/${id}/duplicate`, {
      method: 'POST',
      headers: await getAuthHeaders()
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw parseResponseError('Failed to duplicate product', payload);
    }
    return response.json();
  },

  adjustInventory: async (id: string, delta: number, note?: string): Promise<Product> => {
    const response = await fetch(`${API_BASE}/${id}/inventory`, {
      method: 'PATCH',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ delta, note })
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw parseResponseError('Failed to adjust inventory', payload);
    }
    return response.json();
  }
};
