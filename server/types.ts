export type CartItem = {
  productId: string;
  name: string;
  brand: string;
  price: string;
  image: string;
  quantity: number;
};

export interface Order {
  orderId: number;
  sessionId: string;
  items: CartItem[];
  total: number;
  createdAt: string;
  userId?: string;
  userEmail?: string;
}
