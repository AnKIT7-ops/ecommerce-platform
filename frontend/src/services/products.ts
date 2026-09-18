import { api } from "./api";
import type { Page, Product, ProductDetail, ProductQuery } from "../types";

export const productService = {
  list: (query: ProductQuery = {}, signal?: AbortSignal) =>
    api.get<Page<Product>>("/api/products", {
      auth: false,
      signal,
      query: {
        search: query.search,
        category_id: query.category_id,
        category_slug: query.category_slug,
        min_price: query.min_price,
        max_price: query.max_price,
        in_stock: query.in_stock,
        sort: query.sort,
        page: query.page,
        size: query.size,
      },
    }),

  get: (id: number, signal?: AbortSignal) =>
    api.get<ProductDetail>(`/api/products/${id}`, { auth: false, signal }),

  getBySlug: (slug: string, signal?: AbortSignal) =>
    api.get<ProductDetail>(`/api/products/slug/${encodeURIComponent(slug)}`, {
      auth: false,
      signal,
    }),

  related: (id: number, signal?: AbortSignal) =>
    api.get<Product[]>(`/api/products/${id}/related`, { auth: false, signal }),
};
