import { api } from "./api";
import type { Cart } from "../types";

export const cartService = {
  get: (signal?: AbortSignal) => api.get<Cart>("/api/cart", { signal }),

  addItem: (productId: number, quantity = 1) =>
    api.post<Cart>("/api/cart/items", { product_id: productId, quantity }),

  updateItem: (itemId: number, quantity: number) =>
    api.put<Cart>(`/api/cart/items/${itemId}`, { quantity }),

  removeItem: (itemId: number) => api.delete<Cart>(`/api/cart/items/${itemId}`),

  clear: () => api.delete<{ detail: string }>("/api/cart"),
};
