import { createContext } from "react";

import type { Cart } from "../types";

export interface CartContextValue {
  cart: Cart | null;
  isLoading: boolean;
  /** Sum of quantities, for the header badge. */
  itemCount: number;
  addItem: (productId: number, quantity?: number) => Promise<void>;
  updateItem: (itemId: number, quantity: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  clear: () => Promise<void>;
  reload: () => Promise<void>;
}

// Separated from CartContext.tsx for the same Fast Refresh reason as auth.
export const CartContext = createContext<CartContextValue | null>(null);
