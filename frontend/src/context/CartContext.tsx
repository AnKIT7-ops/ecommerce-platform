import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { cartService } from "../services";
import type { Cart } from "../types";
import { useAuth } from "../hooks/useAuth";
import { CartContext, type CartContextValue } from "./cart-context";


/**
 * The cart lives on the server, keyed to the signed-in user, so there is
 * nothing to show or persist for a signed-out visitor. Adding to the cart from
 * a product page sends them to sign in first and returns them afterwards.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!isAuthenticated) {
      setCart(null);
      return;
    }
    setIsLoading(true);
    try {
      setCart(await cartService.get());
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Load on sign-in, drop on sign-out.
  useEffect(() => {
    let cancelled = false;

    async function sync() {
      if (!isAuthenticated) {
        setCart(null);
        return;
      }
      setIsLoading(true);
      try {
        const next = await cartService.get();
        if (!cancelled) setCart(next);
      } catch {
        if (!cancelled) setCart(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void sync();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // Each mutation returns the whole cart, so the server stays the single source
  // of truth for quantities and stock rather than being patched optimistically.
  const addItem = useCallback(async (productId: number, quantity = 1) => {
    setCart(await cartService.addItem(productId, quantity));
  }, []);

  const updateItem = useCallback(async (itemId: number, quantity: number) => {
    setCart(await cartService.updateItem(itemId, quantity));
  }, []);

  const removeItem = useCallback(async (itemId: number) => {
    setCart(await cartService.removeItem(itemId));
  }, []);

  const clear = useCallback(async () => {
    await cartService.clear();
    setCart(await cartService.get());
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      isLoading,
      itemCount: cart?.total_items ?? 0,
      addItem,
      updateItem,
      removeItem,
      clear,
      reload,
    }),
    [cart, isLoading, addItem, updateItem, removeItem, clear, reload],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
