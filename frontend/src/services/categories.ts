import { api } from "./api";
import type { Category, CategoryWithCount } from "../types";

export const categoryService = {
  list: (signal?: AbortSignal) =>
    api.get<CategoryWithCount[]>("/api/categories", { auth: false, signal }),

  getBySlug: (slug: string, signal?: AbortSignal) =>
    api.get<Category>(`/api/categories/slug/${encodeURIComponent(slug)}`, {
      auth: false,
      signal,
    }),
};
