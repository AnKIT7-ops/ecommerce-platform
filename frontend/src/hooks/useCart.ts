import { useContext } from "react";

import { CartContext, type CartContextValue } from "../context/cart-context";

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (context === null) {
    throw new Error("useCart must be used inside a CartProvider");
  }
  return context;
}
