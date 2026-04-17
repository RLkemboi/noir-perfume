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
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId] = useState<string>(() => {
    let sid = localStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = generateSessionId();
      localStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  });

  // Load cart from server on mount (fallback to localStorage)
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/cart/${sessionId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled && Array.isArray(data?.items)) {
          setItems(data.items);
        }
      })
      .catch(() => {
        const raw = localStorage.getItem(CART_KEY);
        if (!cancelled && raw) {
          try {
            setItems(JSON.parse(raw));
          } catch {
            // ignore parse error
          }
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = async (item: Omit<CartItem, "quantity">) => {
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

    try {
      await fetch(`/api/cart/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...item, quantity: 1 }),
      });
    } catch {
      // Silently fail; local state is already updated
    }
  };

  const removeItem = async (productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
    try {
      await fetch(`/api/cart/${sessionId}/${productId}`, {
        method: "DELETE",
      });
    } catch {
      // Silently fail
    }
  };

  const updateQuantity = async (productId: string, quantity: number) => {
    if (quantity < 1) {
      removeItem(productId);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, quantity } : i))
    );
    try {
      await fetch(`/api/cart/${sessionId}/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      });
    } catch {
      // Silently fail
    }
  };

  const clearCart = async () => {
    setItems([]);
    try {
      await fetch(`/api/cart/${sessionId}`, {
        method: "DELETE",
      });
    } catch {
      // Silently fail
    }
  };

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
