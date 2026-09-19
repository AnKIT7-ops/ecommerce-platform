/**
 * API response types, mirroring the FastAPI schemas.
 *
 * Money always arrives as a string ("49.95"), never a number: JSON numbers
 * become IEEE-754 doubles in the browser, where 19.99 * 3 is 59.97000000000001.
 * Format it with `formatPrice` and do arithmetic with `toMinorUnits`.
 */

export type Money = string;

export type UserRole = "customer" | "admin";

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface AuthResponse extends TokenPair {
  user: User;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryWithCount extends Category {
  product_count: number;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price: Money;
  stock_quantity: number;
  category_id: number | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductDetail extends Product {
  category: Category | null;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface CartItem {
  id: number;
  product_id: number;
  quantity: number;
  product: Product;
  line_total: Money;
}

export interface Cart {
  id: number;
  items: CartItem[];
  total_items: number;
  subtotal: Money;
}

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface OrderItem {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: Money;
  line_total: Money;
}

export interface ShippingDetails {
  shipping_full_name: string;
  shipping_address_line1: string;
  shipping_address_line2: string | null;
  shipping_city: string;
  shipping_postal_code: string;
  shipping_country: string;
  shipping_phone: string | null;
}

export interface OrderSummary {
  id: number;
  status: OrderStatus;
  total_amount: Money;
  item_count: number;
  created_at: string;
}

export interface Order extends ShippingDetails {
  id: number;
  status: OrderStatus;
  total_amount: Money;
  notes: string | null;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

export type ProductSort =
  | "newest"
  | "price_asc"
  | "price_desc"
  | "name_asc"
  | "name_desc";

export interface ProductQuery {
  search?: string;
  category_id?: number;
  category_slug?: string;
  min_price?: string;
  max_price?: string;
  in_stock?: boolean;
  sort?: ProductSort;
  page?: number;
  size?: number;
}
