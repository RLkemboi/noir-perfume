import { useCallback, useEffect, useState } from "react";

const WISHLIST_KEY = "noir-wishlist";

function readWishlist(): string[] {
  try {
    const raw = localStorage.getItem(WISHLIST_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/**
 * localStorage-backed shortlist, no backend. Synced across components via a
 * window event so every heart icon updates together.
 */
export function useWishlist() {
  const [ids, setIds] = useState<string[]>(readWishlist);

  useEffect(() => {
    const sync = () => setIds(readWishlist());
    window.addEventListener("noir-wishlist-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("noir-wishlist-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback((id: string) => {
    const current = readWishlist();
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    try {
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(next));
    } catch {
      // private mode etc. — state still updates for this session
    }
    setIds(next);
    window.dispatchEvent(new Event("noir-wishlist-change"));
  }, []);

  const has = useCallback((id: string) => ids.includes(id), [ids]);

  return { ids, toggle, has, count: ids.length };
}
