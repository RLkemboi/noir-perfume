import React, { createContext, useContext, useEffect, useState } from "react";

export interface CartItem {
  productId: string;
  name: string;
  brand: string;
  price: string;
  image: string;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  sessionId: string;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_KEY = "noir-cart";
const SESSION_KEY = "noir-session";

function parsePrice(price: string): number {
  return Number(price.replace(/[^0-9.]/g, "")) || 0;
}

function generateSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    const raw = localStorage.getItem(CART_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return [];
      }
    }
    return [];
  });
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId] = useState<string>(() => {
    let sid = localStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = generateSessionId();
      localStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  });

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = (item: Omit<CartItem, "quantity">) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === item.productId);
      if (existing) {
        return prev.map((i) =>
          i.productId === item.productId ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    setIsOpen(true);
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity < 1) {
      removeItem(productId);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, quantity } : i))
    );
  };

  const clearCart = () => setItems([]);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + parsePrice(i.price) * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        subtotal,
        isOpen,
        setIsOpen,
        sessionId,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
