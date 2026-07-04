import type { Database } from "./supabase";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Faq = Database["public"]["Tables"]["faqs"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"];
export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];
export type Payment = Database["public"]["Tables"]["payments"]["Row"];
export type Address = Database["public"]["Tables"]["addresses"]["Row"];
export type WishlistItem = Database["public"]["Tables"]["wishlists"]["Row"];
export type Setting = Database["public"]["Tables"]["settings"]["Row"];
export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];

export type CategoryWithChildren = Category & {
  children?: CategoryWithChildren[];
};

export type ProductWithCategory = Product & {
  category?: Category | null;
};

export type OrderWithItems = Order & {
  order_items: (OrderItem & { product?: Product | null })[];
  payment?: Payment | null;
};

export type CartItem = {
  id: string;
  productId: string;
  name: string;
  price: number;
  image: string | null;
  quantity: number;
  slug: string;
};

export type CartState = {
  items: CartItem[];
  isOpen: boolean;
};

export type CheckoutFormData = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  notes?: string;
};

export type OrderStatus =
  | "pending"
  | "payment_verification"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export type UserRole = "customer" | "admin";

export type SiteSettings = {
  upi_id: string;
  upi_name: string;
  upi_qr_url: string;
  whatsapp_number: string;
  whatsapp_message: string;
  store_name: string;
  store_email: string;
  store_phone: string;
  meta_title: string;
  meta_description: string;
  og_image_url: string;
  gtm_id: string;
  ga_id: string;
  meta_pixel_id: string;
  mixpanel_token: string;
};
