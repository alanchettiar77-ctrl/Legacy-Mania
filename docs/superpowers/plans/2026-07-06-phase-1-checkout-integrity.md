# Phase 1 — Checkout/Order/Payment/Inventory Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the real security/integrity gaps found in the platform audit: checkout currently writes `orders`/`order_items`/`payments` directly from the browser with client-supplied prices and a wide-open RLS policy (`WITH CHECK (TRUE)` on insert, `USING (TRUE)` on payment update — any user can currently write or overwrite any order/payment row), order status has no guarded transitions, and the payment-screenshot URL is broken (bucket is private but the code calls `getPublicUrl()`). This phase moves order creation, status transitions, and payment verification fully server-side with real business rules, and adds reservation-aware inventory tracking with a scheduled expiry job.

**Architecture:** Same layered pattern as Phase 0 (repository → service → route). `CheckoutService` calls a new atomic Postgres RPC (`create_order`) so stock validation, price computation, order/item/payment creation, and reservation all happen inside one transaction with row locks — no partial-write races. `OrderService` enforces a guarded status state machine and delegates reservation consume/release to `InventoryService`. `PaymentService` composes both for verify/reject. `MediaService` (from Phase 0) gains a private `payments` namespace and signed-URL support.

**Tech Stack:** Next.js 16.2.9 App Router, TypeScript, Supabase (Postgres + Storage + pg_cron), Zod, Jest.

## Global Constraints

- Repositories do pure data access only; services hold business rules and call repositories; API routes are thin (auth → validate → call one service method → shape response) — same convention as Phase 0.
- Admin routes authenticate via `requireAdmin()` from `src/lib/supabase/admin-auth.ts` (unchanged, already exists).
- Migrations are applied manually via the Supabase dashboard SQL Editor — no CLI in this repo. This plan's migration (Task 1) must be applied, **and `pg_cron` must be enabled first** via the Supabase dashboard's Database → Extensions page if not already enabled, before Task 1's Step 2.
- The 5-card minimum order quantity must be enforced **server-side** — the existing client-side-only guard in `checkout-client.tsx` stays as a UX nicety but is no longer the source of truth.
- Never trust client-supplied prices, totals, or product names — `CheckoutService`/the `create_order` RPC always re-derive these from the live `products` table.
- `payments.order_id` has a `UNIQUE` constraint (schema-enforced) — exactly one payment row per order, no retries create a second row.
- Toast feedback via `sonner`; Zod validation per domain in `src/lib/validation/`; `sharp`-based `MediaService` reused as-is from Phase 0 for file validation.
- No new UI framework or dependency.

---

### Task 1: Database migration — RLS tightening + order/inventory RPCs + reservation-expiry cron

**Files:**
- Create: `supabase/migrations/004_checkout_integrity.sql`

**Interfaces:**
- Produces: Postgres RPCs `create_order(...)`, `consume_reservation(p_product_id, p_quantity)`, `release_reservation(p_product_id, p_quantity)`, and a scheduled `release_expired_reservations()` job. Consumed by Task 3 (`InventoryService`) and Task 6 (`CheckoutService`) via `POST /rest/v1/rpc/<name>`.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/004_checkout_integrity.sql

-- ============================================================
-- TIGHTEN RLS: all order/payment writes now go through
-- service-role-backed API routes, not anon/browser inserts.
-- ============================================================
DROP POLICY IF EXISTS "Anyone can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can insert order items" ON public.order_items;
DROP POLICY IF EXISTS "Anyone can insert payments" ON public.payments;
DROP POLICY IF EXISTS "Anyone can update own payment screenshot" ON public.payments;

-- ============================================================
-- ATOMIC ORDER CREATION
-- Validates stock (with row locks), computes real prices,
-- creates order + order_items + payment, and reserves stock —
-- all in one transaction.
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_order(
  p_order_number TEXT,
  p_user_id UUID,
  p_guest_email TEXT,
  p_shipping_name TEXT,
  p_shipping_email TEXT,
  p_shipping_phone TEXT,
  p_shipping_address TEXT,
  p_shipping_city TEXT,
  p_shipping_state TEXT,
  p_shipping_pincode TEXT,
  p_notes TEXT,
  p_items JSONB
) RETURNS JSONB AS $$
DECLARE
  v_order_id UUID;
  v_subtotal NUMERIC(10, 2) := 0;
  v_item JSONB;
  v_product RECORD;
  v_available INTEGER;
  v_quantity INTEGER;
BEGIN
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one item';
  END IF;

  -- Pass 1: lock each product row, validate availability, accumulate real subtotal.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_quantity := (v_item->>'quantity')::INTEGER;

    SELECT id, price, stock_quantity, reserved_quantity, is_active, name
    INTO v_product
    FROM public.products
    WHERE id = (v_item->>'product_id')::UUID
    FOR UPDATE;

    IF NOT FOUND OR NOT v_product.is_active THEN
      RAISE EXCEPTION 'Product % is not available', v_item->>'product_id';
    END IF;

    v_available := v_product.stock_quantity - v_product.reserved_quantity;
    IF v_available < v_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for %', v_product.name;
    END IF;

    v_subtotal := v_subtotal + (v_product.price * v_quantity);
  END LOOP;

  INSERT INTO public.orders (
    order_number, user_id, guest_email, status, subtotal, shipping_cost, total,
    shipping_name, shipping_email, shipping_phone, shipping_address,
    shipping_city, shipping_state, shipping_pincode, notes
  ) VALUES (
    p_order_number, p_user_id, p_guest_email, 'pending', v_subtotal, 0, v_subtotal,
    p_shipping_name, p_shipping_email, p_shipping_phone, p_shipping_address,
    p_shipping_city, p_shipping_state, p_shipping_pincode, p_notes
  ) RETURNING id INTO v_order_id;

  -- Pass 2: create order_items with real product data, and reserve stock.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_quantity := (v_item->>'quantity')::INTEGER;

    SELECT id, price, name, images INTO v_product
    FROM public.products WHERE id = (v_item->>'product_id')::UUID;

    INSERT INTO public.order_items (
      order_id, product_id, product_name, product_image, quantity, unit_price, total_price
    ) VALUES (
      v_order_id, v_product.id, v_product.name,
      CASE WHEN array_length(v_product.images, 1) > 0 THEN v_product.images[1] ELSE NULL END,
      v_quantity, v_product.price, v_product.price * v_quantity
    );

    UPDATE public.products
    SET reserved_quantity = reserved_quantity + v_quantity
    WHERE id = v_product.id;
  END LOOP;

  INSERT INTO public.payments (order_id, amount, payment_method, status)
  VALUES (v_order_id, v_subtotal, 'upi', 'pending');

  RETURN jsonb_build_object('id', v_order_id, 'order_number', p_order_number, 'total', v_subtotal);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- RESERVATION CONSUME / RELEASE (single-product, used by
-- OrderService when a payment is verified/rejected or an
-- order is cancelled pre-confirmation).
-- ============================================================
CREATE OR REPLACE FUNCTION public.consume_reservation(p_product_id UUID, p_quantity INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE public.products
  SET stock_quantity = stock_quantity - p_quantity,
      reserved_quantity = reserved_quantity - p_quantity
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.release_reservation(p_product_id UUID, p_quantity INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE public.products
  SET reserved_quantity = GREATEST(reserved_quantity - p_quantity, 0)
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- RESERVATION EXPIRY (scheduled): auto-cancel orders stuck in
-- pending/payment_verification past the configured timeout,
-- releasing their reservations.
-- ============================================================
INSERT INTO public.settings (key, value, description)
VALUES ('reservation_expiry_hours', '24', 'Hours before an unconfirmed order auto-cancels and releases reserved stock')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.release_expired_reservations()
RETURNS void AS $$
DECLARE
  v_hours INTEGER;
  v_order RECORD;
  v_item RECORD;
BEGIN
  SELECT COALESCE((value #>> '{}')::INTEGER, 24) INTO v_hours
  FROM public.settings WHERE key = 'reservation_expiry_hours';

  FOR v_order IN
    SELECT id FROM public.orders
    WHERE status IN ('pending', 'payment_verification')
      AND created_at < NOW() - (v_hours || ' hours')::INTERVAL
  LOOP
    FOR v_item IN SELECT product_id, quantity FROM public.order_items WHERE order_id = v_order.id AND product_id IS NOT NULL
    LOOP
      PERFORM public.release_reservation(v_item.product_id, v_item.quantity);
    END LOOP;

    UPDATE public.orders SET status = 'cancelled' WHERE id = v_order.id;

    INSERT INTO public.audit_logs (action, table_name, record_id, new_values)
    VALUES ('auto_cancelled_expired', 'orders', v_order.id::TEXT, jsonb_build_object('status', 'cancelled'));
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE EXTENSION IF NOT EXISTS pg_cron SCHEMA extensions;

SELECT cron.schedule(
  'release-expired-reservations',
  '0 * * * *',
  $$SELECT public.release_expired_reservations();$$
);
```

- [ ] **Step 2: Apply it to the live Supabase project**

In the Supabase dashboard: first confirm `pg_cron` is enabled (Database → Extensions — enable it if not already listed as active), then open the SQL Editor, paste the contents of `supabase/migrations/004_checkout_integrity.sql`, and run it.
Verify: `select * from cron.job where jobname = 'release-expired-reservations';` returns one row. `select proname from pg_proc where proname in ('create_order','consume_reservation','release_reservation','release_expired_reservations');` returns all four. `select value from settings where key = 'reservation_expiry_hours';` returns `24`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/004_checkout_integrity.sql
git commit -m "feat: tighten order/payment RLS and add order/inventory RPCs + reservation-expiry cron"
```

---

### Task 2: Extend `MediaService` for the private `payments` namespace

**Files:**
- Modify: `src/lib/services/media-service.ts`
- Modify: `src/lib/services/media-service.test.ts`

**Interfaces:**
- Consumes: existing `MEDIA_NAMESPACES`, `uploadMedia`, `validateFile` (Phase 0).
- Produces: `MEDIA_NAMESPACES` gains a `payments` entry (`{ bucket: "payments", recommendedWidth: null, recommendedHeight: null, public: false }`); `banners`/`products` gain `public: true`. `uploadMedia`'s `UploadResult.publicUrl` becomes `string | null` (only populated for public namespaces). New export `getSignedMediaUrl(path: string, namespace: MediaNamespace, expiresInSeconds?: number): Promise<string>`. Consumed by Task 8 (screenshot upload) and Task 5 (`PaymentService`).

- [ ] **Step 1: Write the failing test for the new behavior**

Add these tests to the existing `src/lib/services/media-service.test.ts` (append — do not remove any existing test):

```ts
describe("uploadMedia with a private namespace", () => {
  afterEach(() => jest.clearAllMocks());

  it("does not call getPublicUrl for the payments namespace and returns publicUrl: null", async () => {
    mockUpload.mockResolvedValue({ error: null });

    const result = await uploadMedia(ONE_BY_ONE_PNG, "image/png", "payments");

    expect(mockFrom).toHaveBeenCalledWith("payments");
    expect(mockGetPublicUrl).not.toHaveBeenCalled();
    expect(result.publicUrl).toBeNull();
    expect(result.path).toMatch(/^payments\/.+\.png$/);
  });
});

describe("getSignedMediaUrl", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns a signed URL for the given path and namespace", async () => {
    mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: "https://example.com/signed" }, error: null });

    const url = await getSignedMediaUrl("payments/x.png", "payments");

    expect(mockFrom).toHaveBeenCalledWith("payments");
    expect(mockCreateSignedUrl).toHaveBeenCalledWith("payments/x.png", 3600);
    expect(url).toBe("https://example.com/signed");
  });

  it("throws when signed URL creation fails", async () => {
    mockCreateSignedUrl.mockResolvedValue({ data: null, error: { message: "not found" } });

    await expect(getSignedMediaUrl("payments/missing.png", "payments")).rejects.toThrow(/not found/);
  });
});
```

Also update the test file's mock setup at the top to add `createSignedUrl`:

```ts
const mockUpload = jest.fn();
const mockRemove = jest.fn();
const mockGetPublicUrl = jest.fn();
const mockCreateSignedUrl = jest.fn();
const mockFrom = jest.fn(() => ({
  upload: mockUpload,
  remove: mockRemove,
  getPublicUrl: mockGetPublicUrl,
  createSignedUrl: mockCreateSignedUrl,
}));
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- media-service.test`
Expected: FAIL — `getSignedMediaUrl` is not exported, and `uploadMedia("payments", ...)` throws because `"payments"` isn't a valid `MediaNamespace` yet.

- [ ] **Step 3: Update `MEDIA_NAMESPACES` and `uploadMedia`**

In `src/lib/services/media-service.ts`, replace the `MEDIA_NAMESPACES` constant with:

```ts
export const MEDIA_NAMESPACES = {
  banners: { bucket: "banners", recommendedWidth: 728, recommendedHeight: 90, public: true },
  products: { bucket: "products", recommendedWidth: null, recommendedHeight: null, public: true },
  payments: { bucket: "payments", recommendedWidth: null, recommendedHeight: null, public: false },
} as const;
```

Replace the `UploadResult` interface and `uploadMedia` function with:

```ts
export interface UploadResult {
  path: string;
  publicUrl: string | null;
}

export async function uploadMedia(
  file: Buffer,
  mimeType: string,
  namespace: MediaNamespace
): Promise<UploadResult> {
  const config = MEDIA_NAMESPACES[namespace];
  const path = `${namespace}/${randomUUID()}-${Date.now()}.${extensionForMimeType(mimeType)}`;

  const supabase = await createAdminClient();
  const { error } = await supabase.storage.from(config.bucket).upload(path, file, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);

  if (!config.public) {
    return { path, publicUrl: null };
  }

  const { data } = supabase.storage.from(config.bucket).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}
```

- [ ] **Step 4: Add `getSignedMediaUrl`**

Add this new export at the end of `src/lib/services/media-service.ts`:

```ts
export async function getSignedMediaUrl(
  path: string,
  namespace: MediaNamespace,
  expiresInSeconds = 3600
): Promise<string> {
  const config = MEDIA_NAMESPACES[namespace];
  const supabase = await createAdminClient();
  const { data, error } = await supabase.storage
    .from(config.bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data) {
    throw new Error(`Failed to create signed URL: ${error?.message ?? "unknown error"}`);
  }
  return data.signedUrl;
}
```

- [ ] **Step 5: Run the full media-service test file to verify everything passes**

Run: `npm test -- media-service.test`
Expected: PASS — all original tests plus the 3 new ones (13 total).

- [ ] **Step 6: Run the full suite and typecheck to confirm no regressions in existing consumers**

Run: `npm test && npm run type-check`
Expected: all pass — `src/app/api/media/upload/route.ts` and `product-form.tsx` still work since they only ever use the `products`/`banners` (both `public: true`) namespaces, so `publicUrl` is still a real string for them at runtime (the type widening to `string | null` doesn't break their untyped `await res.json()` consumption).

- [ ] **Step 7: Commit**

```bash
git add src/lib/services/media-service.ts src/lib/services/media-service.test.ts
git commit -m "feat: add private payments namespace and signed URLs to MediaService"
```

---

### Task 3: `InventoryService` + `inventory-repository`

**Files:**
- Create: `src/lib/repositories/inventory-repository.ts`
- Create: `src/lib/services/inventory-service.ts`
- Test: `src/lib/services/inventory-service.test.ts`

**Interfaces:**
- Produces: `ReservationItem = { productId: string; quantity: number }`, `consumeReservation(items: ReservationItem[]): Promise<void>`, `releaseReservation(items: ReservationItem[]): Promise<void>` from `@/lib/services/inventory-service`. Consumed by Task 4 (`OrderService`).

- [ ] **Step 1: Write the repository (calls the RPCs from Task 1)**

```ts
// src/lib/repositories/inventory-repository.ts
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

async function callRpc(name: string, params: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`RPC ${name} failed: ${res.status}`);
}

export async function consumeReservationForProduct(productId: string, quantity: number): Promise<void> {
  await callRpc("consume_reservation", { p_product_id: productId, p_quantity: quantity });
}

export async function releaseReservationForProduct(productId: string, quantity: number): Promise<void> {
  await callRpc("release_reservation", { p_product_id: productId, p_quantity: quantity });
}
```

- [ ] **Step 2: Write the failing service test**

```ts
// src/lib/services/inventory-service.test.ts
const mockConsume = jest.fn();
const mockRelease = jest.fn();

jest.mock("@/lib/repositories/inventory-repository", () => ({
  consumeReservationForProduct: (...args: unknown[]) => mockConsume(...args),
  releaseReservationForProduct: (...args: unknown[]) => mockRelease(...args),
}));

import { consumeReservation, releaseReservation } from "@/lib/services/inventory-service";

describe("consumeReservation", () => {
  afterEach(() => jest.clearAllMocks());

  it("calls consumeReservationForProduct once per item", async () => {
    mockConsume.mockResolvedValue(undefined);

    await consumeReservation([
      { productId: "p1", quantity: 2 },
      { productId: "p2", quantity: 1 },
    ]);

    expect(mockConsume).toHaveBeenNthCalledWith(1, "p1", 2);
    expect(mockConsume).toHaveBeenNthCalledWith(2, "p2", 1);
    expect(mockConsume).toHaveBeenCalledTimes(2);
  });
});

describe("releaseReservation", () => {
  afterEach(() => jest.clearAllMocks());

  it("calls releaseReservationForProduct once per item", async () => {
    mockRelease.mockResolvedValue(undefined);

    await releaseReservation([{ productId: "p1", quantity: 3 }]);

    expect(mockRelease).toHaveBeenCalledWith("p1", 3);
  });

  it("does nothing for an empty item list", async () => {
    await releaseReservation([]);
    expect(mockRelease).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test -- inventory-service.test`
Expected: FAIL — `Cannot find module '@/lib/services/inventory-service'`.

- [ ] **Step 4: Implement the service**

```ts
// src/lib/services/inventory-service.ts
import {
  consumeReservationForProduct,
  releaseReservationForProduct,
} from "@/lib/repositories/inventory-repository";

export interface ReservationItem {
  productId: string;
  quantity: number;
}

export async function consumeReservation(items: ReservationItem[]): Promise<void> {
  for (const item of items) {
    await consumeReservationForProduct(item.productId, item.quantity);
  }
}

export async function releaseReservation(items: ReservationItem[]): Promise<void> {
  for (const item of items) {
    await releaseReservationForProduct(item.productId, item.quantity);
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- inventory-service.test`
Expected: PASS — 3 passed tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/repositories/inventory-repository.ts src/lib/services/inventory-service.ts src/lib/services/inventory-service.test.ts
git commit -m "feat: add InventoryService for reservation consume/release"
```

---

### Task 4: `OrderService` — guarded status state machine

**Files:**
- Create: `src/lib/repositories/order-repository.ts`
- Create: `src/lib/services/order-service.ts`
- Test: `src/lib/services/order-service.test.ts`

**Interfaces:**
- Consumes: `OrderStatus` type from `@/types` (already exists), `consumeReservation`/`releaseReservation` (Task 3).
- Produces: `InvalidStatusTransitionError` (class extending `Error`), `updateStatus(orderId: string, newStatus: OrderStatus): Promise<void>` from `@/lib/services/order-service`. Consumed by Task 5 (`PaymentService`) and Task 9 (order status route).

- [ ] **Step 1: Write the repository**

```ts
// src/lib/repositories/order-repository.ts
import type { OrderStatus } from "@/types";

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export interface OrderRow {
  id: string;
  status: OrderStatus;
}

export interface OrderItemRow {
  product_id: string | null;
  quantity: number;
}

export async function getOrderById(orderId: string): Promise<OrderRow | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=id,status&limit=1`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Failed to fetch order: ${res.status}`);
  const rows = await res.json();
  return rows?.[0] ?? null;
}

export async function updateOrderStatusInDb(orderId: string, status: OrderStatus): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`Failed to update order status: ${res.status}`);
}

export async function getOrderItemsForOrder(orderId: string): Promise<OrderItemRow[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/order_items?order_id=eq.${encodeURIComponent(orderId)}&select=product_id,quantity`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Failed to fetch order items: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 2: Write the failing service test**

```ts
// src/lib/services/order-service.test.ts
const mockGetOrderById = jest.fn();
const mockUpdateOrderStatusInDb = jest.fn();
const mockGetOrderItemsForOrder = jest.fn();

jest.mock("@/lib/repositories/order-repository", () => ({
  getOrderById: () => mockGetOrderById(),
  updateOrderStatusInDb: (...args: unknown[]) => mockUpdateOrderStatusInDb(...args),
  getOrderItemsForOrder: () => mockGetOrderItemsForOrder(),
}));

const mockConsumeReservation = jest.fn();
const mockReleaseReservation = jest.fn();

jest.mock("@/lib/services/inventory-service", () => ({
  consumeReservation: (...args: unknown[]) => mockConsumeReservation(...args),
  releaseReservation: (...args: unknown[]) => mockReleaseReservation(...args),
}));

import { updateStatus, InvalidStatusTransitionError } from "@/lib/services/order-service";

describe("updateStatus", () => {
  afterEach(() => jest.clearAllMocks());

  it("throws when the order does not exist", async () => {
    mockGetOrderById.mockResolvedValue(null);

    await expect(updateStatus("missing", "cancelled")).rejects.toThrow(/not found/i);
  });

  it("rejects an invalid transition with InvalidStatusTransitionError", async () => {
    mockGetOrderById.mockResolvedValue({ id: "o1", status: "pending" });

    await expect(updateStatus("o1", "shipped")).rejects.toThrow(InvalidStatusTransitionError);
    expect(mockUpdateOrderStatusInDb).not.toHaveBeenCalled();
  });

  it("allows pending -> payment_verification and does not touch inventory", async () => {
    mockGetOrderById.mockResolvedValue({ id: "o1", status: "pending" });
    mockUpdateOrderStatusInDb.mockResolvedValue(undefined);

    await updateStatus("o1", "payment_verification");

    expect(mockUpdateOrderStatusInDb).toHaveBeenCalledWith("o1", "payment_verification");
    expect(mockConsumeReservation).not.toHaveBeenCalled();
    expect(mockReleaseReservation).not.toHaveBeenCalled();
  });

  it("consumes the reservation when transitioning to confirmed", async () => {
    mockGetOrderById.mockResolvedValue({ id: "o1", status: "payment_verification" });
    mockUpdateOrderStatusInDb.mockResolvedValue(undefined);
    mockGetOrderItemsForOrder.mockResolvedValue([
      { product_id: "p1", quantity: 2 },
      { product_id: null, quantity: 1 },
    ]);

    await updateStatus("o1", "confirmed");

    expect(mockConsumeReservation).toHaveBeenCalledWith([{ productId: "p1", quantity: 2 }]);
  });

  it("releases the reservation when cancelling a pre-confirmation order", async () => {
    mockGetOrderById.mockResolvedValue({ id: "o1", status: "payment_verification" });
    mockUpdateOrderStatusInDb.mockResolvedValue(undefined);
    mockGetOrderItemsForOrder.mockResolvedValue([{ product_id: "p1", quantity: 3 }]);

    await updateStatus("o1", "cancelled");

    expect(mockReleaseReservation).toHaveBeenCalledWith([{ productId: "p1", quantity: 3 }]);
  });

  it("does not touch inventory when cancelling a post-confirmation order", async () => {
    mockGetOrderById.mockResolvedValue({ id: "o1", status: "processing" });
    mockUpdateOrderStatusInDb.mockResolvedValue(undefined);

    await updateStatus("o1", "cancelled");

    expect(mockReleaseReservation).not.toHaveBeenCalled();
    expect(mockConsumeReservation).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test -- order-service.test`
Expected: FAIL — `Cannot find module '@/lib/services/order-service'`.

- [ ] **Step 4: Implement the service**

```ts
// src/lib/services/order-service.ts
import type { OrderStatus } from "@/types";
import {
  getOrderById,
  updateOrderStatusInDb,
  getOrderItemsForOrder,
} from "@/lib/repositories/order-repository";
import { consumeReservation, releaseReservation } from "@/lib/services/inventory-service";

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["payment_verification", "cancelled"],
  payment_verification: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled", "refunded"],
  processing: ["shipped", "cancelled", "refunded"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

const PRE_CONFIRM_STATUSES: OrderStatus[] = ["pending", "payment_verification"];

export class InvalidStatusTransitionError extends Error {}

export async function updateStatus(orderId: string, newStatus: OrderStatus): Promise<void> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error("Order not found");

  const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new InvalidStatusTransitionError(
      `Cannot transition from ${order.status} to ${newStatus}`
    );
  }

  await updateOrderStatusInDb(orderId, newStatus);

  if (newStatus === "confirmed") {
    const items = await getOrderItemsForOrder(orderId);
    const withProduct = items.filter(
      (item): item is { product_id: string; quantity: number } => item.product_id !== null
    );
    await consumeReservation(withProduct.map((i) => ({ productId: i.product_id, quantity: i.quantity })));
  } else if (newStatus === "cancelled" && PRE_CONFIRM_STATUSES.includes(order.status)) {
    const items = await getOrderItemsForOrder(orderId);
    const withProduct = items.filter(
      (item): item is { product_id: string; quantity: number } => item.product_id !== null
    );
    await releaseReservation(withProduct.map((i) => ({ productId: i.product_id, quantity: i.quantity })));
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- order-service.test`
Expected: PASS — 6 passed tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/repositories/order-repository.ts src/lib/services/order-service.ts src/lib/services/order-service.test.ts
git commit -m "feat: add OrderService with a guarded status state machine"
```

---

### Task 5: `PaymentService`

**Files:**
- Create: `src/lib/repositories/payment-repository.ts`
- Create: `src/lib/services/payment-service.ts`
- Test: `src/lib/services/payment-service.test.ts`

**Interfaces:**
- Consumes: `updateStatus` from `@/lib/services/order-service` (Task 4), `getSignedMediaUrl` from `@/lib/services/media-service` (Task 2).
- Produces: `verifyPayment(paymentId: string, adminUserId: string): Promise<void>`, `rejectPayment(paymentId: string, adminUserId: string): Promise<void>`, `getPaymentScreenshotUrl(paymentId: string): Promise<string | null>` from `@/lib/services/payment-service`. Consumed by Task 10 (payment routes).

- [ ] **Step 1: Write the repository**

```ts
// src/lib/repositories/payment-repository.ts
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export interface PaymentRow {
  id: string;
  order_id: string;
  screenshot_url: string | null;
}

export async function getPaymentById(paymentId: string): Promise<PaymentRow | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/payments?id=eq.${encodeURIComponent(paymentId)}&select=id,order_id,screenshot_url&limit=1`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Failed to fetch payment: ${res.status}`);
  const rows = await res.json();
  return rows?.[0] ?? null;
}

export async function updatePaymentStatus(
  paymentId: string,
  status: "verified" | "rejected",
  verifiedBy: string
): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/payments?id=eq.${encodeURIComponent(paymentId)}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ status, verified_by: verifiedBy, verified_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`Failed to update payment status: ${res.status}`);
}
```

- [ ] **Step 2: Write the failing service test**

```ts
// src/lib/services/payment-service.test.ts
const mockGetPaymentById = jest.fn();
const mockUpdatePaymentStatus = jest.fn();

jest.mock("@/lib/repositories/payment-repository", () => ({
  getPaymentById: () => mockGetPaymentById(),
  updatePaymentStatus: (...args: unknown[]) => mockUpdatePaymentStatus(...args),
}));

const mockUpdateOrderStatus = jest.fn();
jest.mock("@/lib/services/order-service", () => ({
  updateStatus: (...args: unknown[]) => mockUpdateOrderStatus(...args),
}));

const mockGetSignedMediaUrl = jest.fn();
jest.mock("@/lib/services/media-service", () => ({
  getSignedMediaUrl: (...args: unknown[]) => mockGetSignedMediaUrl(...args),
}));

import { verifyPayment, rejectPayment, getPaymentScreenshotUrl } from "@/lib/services/payment-service";

describe("verifyPayment", () => {
  afterEach(() => jest.clearAllMocks());

  it("throws when the payment does not exist", async () => {
    mockGetPaymentById.mockResolvedValue(null);
    await expect(verifyPayment("missing", "admin-1")).rejects.toThrow(/not found/i);
  });

  it("marks the payment verified and confirms the order", async () => {
    mockGetPaymentById.mockResolvedValue({ id: "pay-1", order_id: "order-1", screenshot_url: null });
    mockUpdatePaymentStatus.mockResolvedValue(undefined);
    mockUpdateOrderStatus.mockResolvedValue(undefined);

    await verifyPayment("pay-1", "admin-1");

    expect(mockUpdatePaymentStatus).toHaveBeenCalledWith("pay-1", "verified", "admin-1");
    expect(mockUpdateOrderStatus).toHaveBeenCalledWith("order-1", "confirmed");
  });
});

describe("rejectPayment", () => {
  afterEach(() => jest.clearAllMocks());

  it("marks the payment rejected and cancels the order", async () => {
    mockGetPaymentById.mockResolvedValue({ id: "pay-1", order_id: "order-1", screenshot_url: null });
    mockUpdatePaymentStatus.mockResolvedValue(undefined);
    mockUpdateOrderStatus.mockResolvedValue(undefined);

    await rejectPayment("pay-1", "admin-1");

    expect(mockUpdatePaymentStatus).toHaveBeenCalledWith("pay-1", "rejected", "admin-1");
    expect(mockUpdateOrderStatus).toHaveBeenCalledWith("order-1", "cancelled");
  });
});

describe("getPaymentScreenshotUrl", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns null when there is no screenshot", async () => {
    mockGetPaymentById.mockResolvedValue({ id: "pay-1", order_id: "order-1", screenshot_url: null });

    const url = await getPaymentScreenshotUrl("pay-1");

    expect(url).toBeNull();
    expect(mockGetSignedMediaUrl).not.toHaveBeenCalled();
  });

  it("returns a signed URL when a screenshot exists", async () => {
    mockGetPaymentById.mockResolvedValue({ id: "pay-1", order_id: "order-1", screenshot_url: "payments/x.png" });
    mockGetSignedMediaUrl.mockResolvedValue("https://example.com/signed");

    const url = await getPaymentScreenshotUrl("pay-1");

    expect(mockGetSignedMediaUrl).toHaveBeenCalledWith("payments/x.png", "payments");
    expect(url).toBe("https://example.com/signed");
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test -- payment-service.test`
Expected: FAIL — `Cannot find module '@/lib/services/payment-service'`.

- [ ] **Step 4: Implement the service**

```ts
// src/lib/services/payment-service.ts
import { getPaymentById, updatePaymentStatus } from "@/lib/repositories/payment-repository";
import { updateStatus } from "@/lib/services/order-service";
import { getSignedMediaUrl } from "@/lib/services/media-service";

export async function verifyPayment(paymentId: string, adminUserId: string): Promise<void> {
  const payment = await getPaymentById(paymentId);
  if (!payment) throw new Error("Payment not found");

  await updatePaymentStatus(paymentId, "verified", adminUserId);
  await updateStatus(payment.order_id, "confirmed");
}

export async function rejectPayment(paymentId: string, adminUserId: string): Promise<void> {
  const payment = await getPaymentById(paymentId);
  if (!payment) throw new Error("Payment not found");

  await updatePaymentStatus(paymentId, "rejected", adminUserId);
  await updateStatus(payment.order_id, "cancelled");
}

export async function getPaymentScreenshotUrl(paymentId: string): Promise<string | null> {
  const payment = await getPaymentById(paymentId);
  if (!payment?.screenshot_url) return null;
  return getSignedMediaUrl(payment.screenshot_url, "payments");
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- payment-service.test`
Expected: PASS — 5 passed tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/repositories/payment-repository.ts src/lib/services/payment-service.ts src/lib/services/payment-service.test.ts
git commit -m "feat: add PaymentService for verify/reject and signed screenshot URLs"
```

---

### Task 6: Checkout validation + `CheckoutService`

**Files:**
- Create: `src/lib/validation/checkout.ts`
- Create: `src/lib/repositories/checkout-repository.ts`
- Create: `src/lib/services/checkout-service.ts`
- Test: `src/lib/validation/checkout.test.ts`
- Test: `src/lib/services/checkout-service.test.ts`

**Interfaces:**
- Consumes: `generateOrderNumber` from `@/lib/utils` (already exists).
- Produces: `checkoutSchema`, `CheckoutInput` type from `@/lib/validation/checkout`. `createOrder(input: CheckoutInput, userId: string | null): Promise<{ orderId: string; orderNumber: string; total: number }>` from `@/lib/services/checkout-service`. Consumed by Task 7 (checkout route).

- [ ] **Step 1: Write the failing validation test**

```ts
// src/lib/validation/checkout.test.ts
import { checkoutSchema } from "@/lib/validation/checkout";

const validInput = {
  items: [{ productId: "550e8400-e29b-41d4-a716-446655440000", quantity: 5 }],
  name: "Arjun Sharma",
  email: "arjun@example.com",
  phone: "9876543210",
  address: "123 MG Road, Flat 4B",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400001",
};

describe("checkoutSchema", () => {
  it("accepts a fully valid checkout payload", () => {
    expect(checkoutSchema.safeParse(validInput).success).toBe(true);
  });

  it("rejects an empty items array", () => {
    const result = checkoutSchema.safeParse({ ...validInput, items: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a non-Indian mobile number", () => {
    const result = checkoutSchema.safeParse({ ...validInput, phone: "12345" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid pincode", () => {
    const result = checkoutSchema.safeParse({ ...validInput, pincode: "1234" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive item quantity", () => {
    const result = checkoutSchema.safeParse({
      ...validInput,
      items: [{ productId: validInput.items[0].productId, quantity: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts an optional notes field", () => {
    const result = checkoutSchema.safeParse({ ...validInput, notes: "Leave at the door" });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- checkout.test`
Expected: FAIL — `Cannot find module '@/lib/validation/checkout'`.

- [ ] **Step 3: Implement the validation schema**

```ts
// src/lib/validation/checkout.ts
import { z } from "zod";

export const checkoutItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

export const checkoutSchema = z.object({
  items: z.array(checkoutItemSchema).min(1, "At least one item is required"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian mobile number"),
  address: z.string().min(10, "Please enter a complete address"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(1, "State is required"),
  pincode: z.string().regex(/^\d{6}$/, "Invalid pincode"),
  notes: z.string().optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
```

- [ ] **Step 4: Run the validation test to verify it passes**

Run: `npm test -- checkout.test`
Expected: PASS — 6 passed tests.

- [ ] **Step 5: Write the checkout repository**

```ts
// src/lib/repositories/checkout-repository.ts
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export interface CreateOrderParams {
  orderNumber: string;
  userId: string | null;
  guestEmail: string | null;
  shippingName: string;
  shippingEmail: string;
  shippingPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPincode: string;
  notes: string | null;
  items: { productId: string; quantity: number }[];
}

export interface CreatedOrder {
  id: string;
  order_number: string;
  total: number;
}

export async function createOrderViaRpc(params: CreateOrderParams): Promise<CreatedOrder> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/create_order`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_order_number: params.orderNumber,
      p_user_id: params.userId,
      p_guest_email: params.guestEmail,
      p_shipping_name: params.shippingName,
      p_shipping_email: params.shippingEmail,
      p_shipping_phone: params.shippingPhone,
      p_shipping_address: params.shippingAddress,
      p_shipping_city: params.shippingCity,
      p_shipping_state: params.shippingState,
      p_shipping_pincode: params.shippingPincode,
      p_notes: params.notes,
      p_items: params.items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || "Failed to create order");
  }

  return res.json();
}
```

- [ ] **Step 6: Write the failing service test**

```ts
// src/lib/services/checkout-service.test.ts
const mockCreateOrderViaRpc = jest.fn();

jest.mock("@/lib/repositories/checkout-repository", () => ({
  createOrderViaRpc: (...args: unknown[]) => mockCreateOrderViaRpc(...args),
}));

import { createOrder } from "@/lib/services/checkout-service";
import type { CheckoutInput } from "@/lib/validation/checkout";

const baseInput: CheckoutInput = {
  items: [{ productId: "550e8400-e29b-41d4-a716-446655440000", quantity: 5 }],
  name: "Arjun Sharma",
  email: "arjun@example.com",
  phone: "9876543210",
  address: "123 MG Road, Flat 4B",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400001",
};

describe("createOrder", () => {
  afterEach(() => jest.clearAllMocks());

  it("rejects an order below the 5-card minimum before calling the repository", async () => {
    const input = { ...baseInput, items: [{ ...baseInput.items[0], quantity: 4 }] };

    await expect(createOrder(input, null)).rejects.toThrow(/minimum order quantity is 5/i);
    expect(mockCreateOrderViaRpc).not.toHaveBeenCalled();
  });

  it("sums quantities across multiple items to check the minimum", async () => {
    const input = {
      ...baseInput,
      items: [
        { productId: "550e8400-e29b-41d4-a716-446655440000", quantity: 2 },
        { productId: "660e8400-e29b-41d4-a716-446655440001", quantity: 3 },
      ],
    };
    mockCreateOrderViaRpc.mockResolvedValue({ id: "order-1", order_number: "LM-123", total: 500 });

    const result = await createOrder(input, null);

    expect(mockCreateOrderViaRpc).toHaveBeenCalled();
    expect(result.orderId).toBe("order-1");
  });

  it("passes guestEmail when there is no signed-in user", async () => {
    mockCreateOrderViaRpc.mockResolvedValue({ id: "order-1", order_number: "LM-123", total: 500 });

    await createOrder(baseInput, null);

    const [params] = mockCreateOrderViaRpc.mock.calls[0];
    expect(params.userId).toBeNull();
    expect(params.guestEmail).toBe("arjun@example.com");
  });

  it("passes userId and null guestEmail when a user is signed in", async () => {
    mockCreateOrderViaRpc.mockResolvedValue({ id: "order-1", order_number: "LM-123", total: 500 });

    await createOrder(baseInput, "user-1");

    const [params] = mockCreateOrderViaRpc.mock.calls[0];
    expect(params.userId).toBe("user-1");
    expect(params.guestEmail).toBeNull();
  });

  it("returns the order id, order number, and total from the RPC result", async () => {
    mockCreateOrderViaRpc.mockResolvedValue({ id: "order-1", order_number: "LM-999", total: 1234.5 });

    const result = await createOrder(baseInput, null);

    expect(result).toEqual({ orderId: "order-1", orderNumber: "LM-999", total: 1234.5 });
  });
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npm test -- checkout-service.test`
Expected: FAIL — `Cannot find module '@/lib/services/checkout-service'`.

- [ ] **Step 8: Implement the service**

```ts
// src/lib/services/checkout-service.ts
import type { CheckoutInput } from "@/lib/validation/checkout";
import { createOrderViaRpc } from "@/lib/repositories/checkout-repository";
import { generateOrderNumber } from "@/lib/utils";

const MIN_ORDER_QUANTITY = 5;

export interface CreateOrderResult {
  orderId: string;
  orderNumber: string;
  total: number;
}

export async function createOrder(
  input: CheckoutInput,
  userId: string | null
): Promise<CreateOrderResult> {
  const totalQuantity = input.items.reduce((sum, item) => sum + item.quantity, 0);
  if (totalQuantity < MIN_ORDER_QUANTITY) {
    throw new Error(`Minimum order quantity is ${MIN_ORDER_QUANTITY} cards`);
  }

  const order = await createOrderViaRpc({
    orderNumber: generateOrderNumber(),
    userId,
    guestEmail: userId ? null : input.email,
    shippingName: input.name,
    shippingEmail: input.email,
    shippingPhone: input.phone,
    shippingAddress: input.address,
    shippingCity: input.city,
    shippingState: input.state,
    shippingPincode: input.pincode,
    notes: input.notes ?? null,
    items: input.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
  });

  return { orderId: order.id, orderNumber: order.order_number, total: order.total };
}
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npm test -- checkout-service.test`
Expected: PASS — 5 passed tests.

- [ ] **Step 10: Commit**

```bash
git add src/lib/validation/checkout.ts src/lib/validation/checkout.test.ts src/lib/repositories/checkout-repository.ts src/lib/services/checkout-service.ts src/lib/services/checkout-service.test.ts
git commit -m "feat: add CheckoutService with server-side price truth and 5-item minimum"
```

---

### Task 7: `POST /api/checkout`

**Files:**
- Create: `src/app/api/checkout/route.ts`
- Test: `src/app/api/checkout/route.test.ts`

**Interfaces:**
- Consumes: `checkoutSchema` (Task 6), `createOrder` (Task 6), `checkRateLimit`/`rateLimitResponse` (Phase 0).
- Produces: `POST /api/checkout` → `201` with `{ orderId, orderNumber, total }`, `400` on validation/business-rule failure, `429` when rate-limited. No auth required (guest checkout).

- [ ] **Step 1: Write the failing test**

```ts
/**
 * @jest-environment node
 */
// src/app/api/checkout/route.test.ts

const mockCheckRateLimit = jest.fn();
jest.mock("@/lib/rate-limit", () => {
  const actual = jest.requireActual("@/lib/rate-limit");
  return { ...actual, checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args) };
});

const mockCreateOrder = jest.fn();
jest.mock("@/lib/services/checkout-service", () => ({
  createOrder: (...args: unknown[]) => mockCreateOrder(...args),
}));

const mockGetUser = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/checkout/route";

const validBody = {
  items: [{ productId: "550e8400-e29b-41d4-a716-446655440000", quantity: 5 }],
  name: "Arjun Sharma",
  email: "arjun@example.com",
  phone: "9876543210",
  address: "123 MG Road, Flat 4B",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400001",
};

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/checkout", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/checkout", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns 429 when rate-limited", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 1000 });

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(429);
  });

  it("returns 400 when the body fails validation", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 });

    const response = await POST(makeRequest({ ...validBody, phone: "invalid" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("returns 400 with the service's error message when createOrder rejects", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 });
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockCreateOrder.mockRejectedValue(new Error("Insufficient stock for Charizard Holo"));

    const response = await POST(makeRequest(validBody));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Insufficient stock for Charizard Holo");
  });

  it("creates the order for a guest and returns 201", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 });
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockCreateOrder.mockResolvedValue({ orderId: "order-1", orderNumber: "LM-123", total: 500 });

    const response = await POST(makeRequest(validBody));
    const body = await response.json();

    expect(mockCreateOrder).toHaveBeenCalledWith(expect.objectContaining({ name: "Arjun Sharma" }), null);
    expect(response.status).toBe(201);
    expect(body.orderNumber).toBe("LM-123");
  });

  it("passes the signed-in user's id when a session exists", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 });
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockCreateOrder.mockResolvedValue({ orderId: "order-1", orderNumber: "LM-123", total: 500 });

    await POST(makeRequest(validBody));

    expect(mockCreateOrder).toHaveBeenCalledWith(expect.anything(), "user-1");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- "api/checkout/route.test"`
Expected: FAIL — `Cannot find module '@/app/api/checkout/route'`.

- [ ] **Step 3: Implement the route**

```ts
// src/app/api/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkoutSchema } from "@/lib/validation/checkout";
import { createOrder } from "@/lib/services/checkout-service";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rateLimit = checkRateLimit(`checkout:${ip}`, 10, 60_000);
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.resetAt);

  const json = await req.json();
  const parsed = checkoutSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    const result = await createOrder(parsed.data, user?.id ?? null);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create order";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- "api/checkout/route.test"`
Expected: PASS — 5 passed tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/checkout/route.ts src/app/api/checkout/route.test.ts
git commit -m "feat: add POST /api/checkout with server-side price truth"
```

---

### Task 8: `POST /api/checkout/:orderId/screenshot`

**Files:**
- Create: `src/app/api/checkout/[orderId]/screenshot/route.ts`
- Test: `src/app/api/checkout/[orderId]/screenshot/route.test.ts`

**Interfaces:**
- Consumes: `validateFile`/`uploadMedia` with the `"payments"` namespace (Task 2), `checkRateLimit`/`rateLimitResponse`.
- Produces: `POST /api/checkout/:orderId/screenshot` → `200` with `{ success: true }`, `400` on validation failure, `429` when rate-limited, `500` on storage/DB failure. No auth required (guest checkout continuation) — the `orderId` is the effective capability token here since it's a UUID the customer already received from Task 7's response.

- [ ] **Step 1: Write the failing test**

```ts
/**
 * @jest-environment node
 */
// src/app/api/checkout/[orderId]/screenshot/route.test.ts

const mockCheckRateLimit = jest.fn();
jest.mock("@/lib/rate-limit", () => {
  const actual = jest.requireActual("@/lib/rate-limit");
  return { ...actual, checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args) };
});

const mockValidateFile = jest.fn();
const mockUploadMedia = jest.fn();
jest.mock("@/lib/services/media-service", () => {
  const actual = jest.requireActual("@/lib/services/media-service");
  return {
    ...actual,
    validateFile: (...args: unknown[]) => mockValidateFile(...args),
    uploadMedia: (...args: unknown[]) => mockUploadMedia(...args),
  };
});

const mockEq = jest.fn();
const mockUpdate = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ update: mockUpdate }));
jest.mock("@/lib/supabase/server", () => ({
  createAdminClient: async () => ({ from: mockFrom }),
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/checkout/[orderId]/screenshot/route";

function makeRequest(fileContent: string | null) {
  const formData = new FormData();
  if (fileContent !== null) {
    formData.append("file", new Blob([fileContent], { type: "image/png" }), "screenshot.png");
  }
  const req = new NextRequest("http://localhost/api/checkout/order-1/screenshot", {
    method: "POST",
    body: formData,
  });
  return { req, params: Promise.resolve({ orderId: "order-1" }) };
}

describe("POST /api/checkout/:orderId/screenshot", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns 429 when rate-limited", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 1000 });

    const { req, params } = makeRequest("data");
    const response = await POST(req, { params });

    expect(response.status).toBe(429);
  });

  it("returns 400 when no file is provided", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 });

    const { req, params } = makeRequest(null);
    const response = await POST(req, { params });

    expect(response.status).toBe(400);
  });

  it("returns 400 when validation fails", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 });
    mockValidateFile.mockResolvedValue({ valid: false, error: "File exceeds the 2MB maximum size." });

    const { req, params } = makeRequest("data");
    const response = await POST(req, { params });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("File exceeds the 2MB maximum size.");
  });

  it("uploads via the payments namespace, updates the payment and order, and returns success", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 });
    mockValidateFile.mockResolvedValue({ valid: true });
    mockUploadMedia.mockResolvedValue({ path: "payments/order-1.png", publicUrl: null });
    mockEq.mockResolvedValue({ error: null });

    const { req, params } = makeRequest("data");
    const response = await POST(req, { params });
    const body = await response.json();

    expect(mockUploadMedia).toHaveBeenCalledWith(expect.any(Buffer), "image/png", "payments");
    expect(mockFrom).toHaveBeenCalledWith("payments");
    expect(mockFrom).toHaveBeenCalledWith("orders");
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("returns 500 when the database update fails", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 });
    mockValidateFile.mockResolvedValue({ valid: true });
    mockUploadMedia.mockResolvedValue({ path: "payments/order-1.png", publicUrl: null });
    mockEq.mockResolvedValue({ error: { message: "db down" } });

    const { req, params } = makeRequest("data");
    const response = await POST(req, { params });

    expect(response.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- "checkout/\[orderId\]/screenshot/route.test"`
Expected: FAIL — `Cannot find module '@/app/api/checkout/[orderId]/screenshot/route'`.

- [ ] **Step 3: Implement the route**

```ts
// src/app/api/checkout/[orderId]/screenshot/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { validateFile, uploadMedia } from "@/lib/services/media-service";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

type RouteParams = { params: Promise<{ orderId: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { orderId } = await params;

  const rateLimit = checkRateLimit(`checkout-screenshot:${orderId}`, 5, 60_000);
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.resetAt);

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "A file is required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type;

  const validation = await validateFile(buffer, mimeType, "payments");
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const result = await uploadMedia(buffer, mimeType, "payments");

    const supabase = await createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const { error: paymentError } = await db
      .from("payments")
      .update({ screenshot_url: result.path })
      .eq("order_id", orderId);
    if (paymentError) throw new Error(paymentError.message);

    const { error: orderError } = await db
      .from("orders")
      .update({ status: "payment_verification" })
      .eq("id", orderId);
    if (orderError) throw new Error(orderError.message);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit payment screenshot";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- "checkout/\[orderId\]/screenshot/route.test"`
Expected: PASS — 5 passed tests.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/checkout/[orderId]/screenshot/route.ts" "src/app/api/checkout/[orderId]/screenshot/route.test.ts"
git commit -m "feat: add POST /api/checkout/:orderId/screenshot via MediaService"
```

---

### Task 9: `PATCH /api/admin/orders/:id/status`

**Files:**
- Create: `src/app/api/admin/orders/[id]/status/route.ts`
- Test: `src/app/api/admin/orders/[id]/status/route.test.ts`

**Interfaces:**
- Consumes: `requireAdmin()`, `updateStatus`/`InvalidStatusTransitionError` (Task 4).
- Produces: `PATCH /api/admin/orders/:id/status` → `200` with `{ success: true }`, `400` on invalid body, `401`/`403` from `requireAdmin()`, `409` on an invalid transition, `500` on other failure.

- [ ] **Step 1: Write the failing test**

```ts
/**
 * @jest-environment node
 */
// src/app/api/admin/orders/[id]/status/route.test.ts

const mockRequireAdmin = jest.fn();
jest.mock("@/lib/supabase/admin-auth", () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

const mockUpdateStatus = jest.fn();
jest.mock("@/lib/services/order-service", () => {
  const actual = jest.requireActual("@/lib/services/order-service");
  return { ...actual, updateStatus: (...args: unknown[]) => mockUpdateStatus(...args) };
});

import { NextRequest, NextResponse } from "next/server";
import { PATCH } from "@/app/api/admin/orders/[id]/status/route";
import { InvalidStatusTransitionError } from "@/lib/services/order-service";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/orders/order-1/status", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/admin/orders/:id/status", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns the requireAdmin response when not authorized", async () => {
    const forbidden = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    mockRequireAdmin.mockResolvedValue({ ok: false, response: forbidden });

    const response = await PATCH(makeRequest({ status: "confirmed" }), {
      params: Promise.resolve({ id: "order-1" }),
    });

    expect(response.status).toBe(403);
  });

  it("returns 400 for an invalid status value", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });

    const response = await PATCH(makeRequest({ status: "not-a-status" }), {
      params: Promise.resolve({ id: "order-1" }),
    });

    expect(response.status).toBe(400);
  });

  it("returns 409 when the transition is invalid", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockUpdateStatus.mockRejectedValue(new InvalidStatusTransitionError("Cannot transition from pending to shipped"));

    const response = await PATCH(makeRequest({ status: "shipped" }), {
      params: Promise.resolve({ id: "order-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toMatch(/cannot transition/i);
  });

  it("updates the status and returns success", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockUpdateStatus.mockResolvedValue(undefined);

    const response = await PATCH(makeRequest({ status: "processing" }), {
      params: Promise.resolve({ id: "order-1" }),
    });
    const body = await response.json();

    expect(mockUpdateStatus).toHaveBeenCalledWith("order-1", "processing");
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- "admin/orders/\[id\]/status/route.test"`
Expected: FAIL — `Cannot find module '@/app/api/admin/orders/[id]/status/route'`.

- [ ] **Step 3: Implement the route**

```ts
// src/app/api/admin/orders/[id]/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { updateStatus, InvalidStatusTransitionError } from "@/lib/services/order-service";

const statusSchema = z.object({
  status: z.enum([
    "pending",
    "payment_verification",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
    "refunded",
  ]),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const json = await req.json();
  const parsed = statusSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid status is required" }, { status: 400 });
  }

  try {
    await updateStatus(id, parsed.data.status);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof InvalidStatusTransitionError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "Failed to update order status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- "admin/orders/\[id\]/status/route.test"`
Expected: PASS — 4 passed tests.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/admin/orders/[id]/status/route.ts" "src/app/api/admin/orders/[id]/status/route.test.ts"
git commit -m "feat: add PATCH /api/admin/orders/:id/status with guarded transitions"
```

---

### Task 10: Payment verify/reject routes + `/admin/payments` page

**Files:**
- Create: `src/app/api/admin/payments/[id]/verify/route.ts`
- Create: `src/app/api/admin/payments/[id]/reject/route.ts`
- Create: `src/app/api/admin/payments/[id]/screenshot-url/route.ts`
- Test: `src/app/api/admin/payments/[id]/verify/route.test.ts`
- Test: `src/app/api/admin/payments/[id]/reject/route.test.ts`
- Test: `src/app/api/admin/payments/[id]/screenshot-url/route.test.ts`
- Create: `src/app/admin/payments/page.tsx`
- Create: `src/app/admin/payments/payments-table.tsx`
- Modify: `src/components/admin/admin-sidebar.tsx`

**Interfaces:**
- Consumes: `requireAdmin()`, `verifyPayment`/`rejectPayment`/`getPaymentScreenshotUrl` (Task 5).

- [ ] **Step 1: Write the failing tests for all three routes**

```ts
/**
 * @jest-environment node
 */
// src/app/api/admin/payments/[id]/verify/route.test.ts

const mockRequireAdmin = jest.fn();
jest.mock("@/lib/supabase/admin-auth", () => ({ requireAdmin: () => mockRequireAdmin() }));

const mockVerifyPayment = jest.fn();
jest.mock("@/lib/services/payment-service", () => ({
  verifyPayment: (...args: unknown[]) => mockVerifyPayment(...args),
}));

import { NextRequest, NextResponse } from "next/server";
import { PATCH } from "@/app/api/admin/payments/[id]/verify/route";

describe("PATCH /api/admin/payments/:id/verify", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns the requireAdmin response when not authorized", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await PATCH(new NextRequest("http://localhost/x", { method: "PATCH" }), {
      params: Promise.resolve({ id: "pay-1" }),
    });

    expect(response.status).toBe(401);
  });

  it("verifies the payment and returns success", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockVerifyPayment.mockResolvedValue(undefined);

    const response = await PATCH(new NextRequest("http://localhost/x", { method: "PATCH" }), {
      params: Promise.resolve({ id: "pay-1" }),
    });
    const body = await response.json();

    expect(mockVerifyPayment).toHaveBeenCalledWith("pay-1", "admin-1");
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("returns 500 when verification fails", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockVerifyPayment.mockRejectedValue(new Error("Payment not found"));

    const response = await PATCH(new NextRequest("http://localhost/x", { method: "PATCH" }), {
      params: Promise.resolve({ id: "pay-1" }),
    });

    expect(response.status).toBe(500);
  });
});
```

```ts
/**
 * @jest-environment node
 */
// src/app/api/admin/payments/[id]/reject/route.test.ts

const mockRequireAdmin = jest.fn();
jest.mock("@/lib/supabase/admin-auth", () => ({ requireAdmin: () => mockRequireAdmin() }));

const mockRejectPayment = jest.fn();
jest.mock("@/lib/services/payment-service", () => ({
  rejectPayment: (...args: unknown[]) => mockRejectPayment(...args),
}));

import { NextRequest, NextResponse } from "next/server";
import { PATCH } from "@/app/api/admin/payments/[id]/reject/route";

describe("PATCH /api/admin/payments/:id/reject", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns the requireAdmin response when not authorized", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });

    const response = await PATCH(new NextRequest("http://localhost/x", { method: "PATCH" }), {
      params: Promise.resolve({ id: "pay-1" }),
    });

    expect(response.status).toBe(403);
  });

  it("rejects the payment and returns success", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockRejectPayment.mockResolvedValue(undefined);

    const response = await PATCH(new NextRequest("http://localhost/x", { method: "PATCH" }), {
      params: Promise.resolve({ id: "pay-1" }),
    });
    const body = await response.json();

    expect(mockRejectPayment).toHaveBeenCalledWith("pay-1", "admin-1");
    expect(body.success).toBe(true);
  });
});
```

```ts
/**
 * @jest-environment node
 */
// src/app/api/admin/payments/[id]/screenshot-url/route.test.ts

const mockRequireAdmin = jest.fn();
jest.mock("@/lib/supabase/admin-auth", () => ({ requireAdmin: () => mockRequireAdmin() }));

const mockGetPaymentScreenshotUrl = jest.fn();
jest.mock("@/lib/services/payment-service", () => ({
  getPaymentScreenshotUrl: (...args: unknown[]) => mockGetPaymentScreenshotUrl(...args),
}));

import { NextRequest, NextResponse } from "next/server";
import { GET } from "@/app/api/admin/payments/[id]/screenshot-url/route";

describe("GET /api/admin/payments/:id/screenshot-url", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns the requireAdmin response when not authorized", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await GET(new NextRequest("http://localhost/x"), {
      params: Promise.resolve({ id: "pay-1" }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 404 when there is no screenshot", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockGetPaymentScreenshotUrl.mockResolvedValue(null);

    const response = await GET(new NextRequest("http://localhost/x"), {
      params: Promise.resolve({ id: "pay-1" }),
    });

    expect(response.status).toBe(404);
  });

  it("returns the signed URL when one exists", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockGetPaymentScreenshotUrl.mockResolvedValue("https://example.com/signed");

    const response = await GET(new NextRequest("http://localhost/x"), {
      params: Promise.resolve({ id: "pay-1" }),
    });
    const body = await response.json();

    expect(body.url).toBe("https://example.com/signed");
  });
});
```

- [ ] **Step 2: Run all three to verify they fail**

Run: `npm test -- "admin/payments"`
Expected: FAIL — none of the three route modules exist yet.

- [ ] **Step 3: Implement the verify route**

```ts
// src/app/api/admin/payments/[id]/verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { verifyPayment } from "@/lib/services/payment-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    await verifyPayment(id, auth.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to verify payment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Implement the reject route**

```ts
// src/app/api/admin/payments/[id]/reject/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { rejectPayment } from "@/lib/services/payment-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    await rejectPayment(id, auth.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reject payment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 5: Implement the screenshot-url route**

```ts
// src/app/api/admin/payments/[id]/screenshot-url/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { getPaymentScreenshotUrl } from "@/lib/services/payment-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    const url = await getPaymentScreenshotUrl(id);
    if (!url) return NextResponse.json({ error: "No screenshot available" }, { status: 404 });
    return NextResponse.json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get screenshot URL";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 6: Run all three tests to verify they pass**

Run: `npm test -- "admin/payments"`
Expected: PASS — 8 passed tests (3 + 2 + 3).

- [ ] **Step 7: Create the admin payments page (server component)**

```tsx
// src/app/admin/payments/page.tsx
import { createClient } from "@/lib/supabase/server";
import PaymentsTable from "./payments-table";

export default async function AdminPaymentsPage() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: paymentsRaw } = await db
    .from("payments")
    .select("*, order:orders(order_number, shipping_name)")
    .order("created_at", { ascending: false });

  const payments = paymentsRaw ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Payments</h1>
        <p className="text-muted-foreground text-sm">{payments.length} payments total</p>
      </div>
      <PaymentsTable initialPayments={payments} />
    </div>
  );
}
```

- [ ] **Step 8: Create the client table**

```tsx
// src/app/admin/payments/payments-table.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";

interface PaymentRow {
  id: string;
  amount: number;
  status: "pending" | "verified" | "rejected";
  created_at: string;
  order: { order_number: string; shipping_name: string } | null;
}

async function apiRequest(path: string, options?: RequestInit) {
  const res = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "Request failed");
  return body;
}

export default function PaymentsTable({ initialPayments }: { initialPayments: PaymentRow[] }) {
  const [payments, setPayments] = useState(initialPayments);

  const verify = async (id: string) => {
    try {
      await apiRequest(`/api/admin/payments/${id}/verify`, { method: "PATCH" });
      setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, status: "verified" } : p)));
      toast.success("Payment verified");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to verify payment");
    }
  };

  const reject = async (id: string) => {
    try {
      await apiRequest(`/api/admin/payments/${id}/reject`, { method: "PATCH" });
      setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, status: "rejected" } : p)));
      toast.success("Payment rejected");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject payment");
    }
  };

  const viewScreenshot = async (id: string) => {
    try {
      const { url } = await apiRequest(`/api/admin/payments/${id}/screenshot-url`);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No screenshot available");
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Order</th>
              <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer</th>
              <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount</th>
              <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
              <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
              <th className="text-right p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id} className="border-b border-border last:border-0 hover:bg-accent/20 transition-colors">
                <td className="p-4 text-sm font-mono">{payment.order?.order_number ?? "—"}</td>
                <td className="p-4 text-sm">{payment.order?.shipping_name ?? "—"}</td>
                <td className="p-4 text-sm font-semibold">{formatCurrency(payment.amount)}</td>
                <td className="p-4">
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      payment.status === "verified"
                        ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                        : payment.status === "rejected"
                        ? "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                        : "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300"
                    }`}
                  >
                    {payment.status}
                  </span>
                </td>
                <td className="p-4 text-sm text-muted-foreground">{formatDate(payment.created_at)}</td>
                <td className="p-4">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => viewScreenshot(payment.id)} className="text-xs text-primary hover:underline">
                      View Screenshot
                    </button>
                    {payment.status === "pending" && (
                      <>
                        <button
                          onClick={() => verify(payment.id)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-green-500/10 text-green-600 hover:bg-green-500/20"
                        >
                          Verify
                        </button>
                        <button
                          onClick={() => reject(payment.id)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {payments.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">No payments yet.</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Add the sidebar nav entry**

In `src/components/admin/admin-sidebar.tsx`, add the `Wallet` icon to the existing lucide-react import and a new nav item right after `"Orders"`:

```ts
import {
  LayoutDashboard, Package, Tag, ShoppingBag, Wallet,
  Users, BarChart3, Settings, Zap, ChevronRight, Shield, HelpCircle
} from "lucide-react";
```

```ts
const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/payments", label: "Payments", icon: Wallet },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: Tag },
  { href: "/admin/faqs", label: "FAQs", icon: HelpCircle },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/admins", label: "Admin Access", icon: Shield },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];
```

- [ ] **Step 10: Run the full suite and typecheck**

Run: `npm test && npm run type-check`
Expected: all pass, no errors.

- [ ] **Step 11: Commit**

```bash
git add "src/app/api/admin/payments" src/app/admin/payments src/components/admin/admin-sidebar.tsx
git commit -m "feat: add payment verify/reject routes and /admin/payments page"
```

---

### Task 11: Migrate `checkout-client.tsx` to the new server-side APIs

**Files:**
- Modify: `src/app/(shop)/checkout/checkout-client.tsx`

**Interfaces:**
- Consumes: `POST /api/checkout` (Task 7), `POST /api/checkout/:orderId/screenshot` (Task 8).

- [ ] **Step 1: Update the `@/lib/utils` import**

`generateOrderNumber` is no longer called from this file once `onSubmitDetails` is replaced in Step 2 below (order numbers are now generated server-side in `CheckoutService`). In `src/app/(shop)/checkout/checkout-client.tsx`, replace the import line (currently line 16):

```tsx
import { formatCurrency, INDIAN_STATES, generateOrderNumber, getWhatsAppUrl, getOrderWhatsAppMessage } from "@/lib/utils";
```

with:

```tsx
import { formatCurrency, INDIAN_STATES, getWhatsAppUrl, getOrderWhatsAppMessage } from "@/lib/utils";
```

- [ ] **Step 2: Replace `onSubmitDetails`**

Replace the entire `onSubmitDetails` function (currently at lines 76–141, which inserts directly into `orders`/`order_items`/`payments` via the browser Supabase client) with:

```tsx
  const onSubmitDetails = async (data: CheckoutFormData) => {
    try {
      const supabase = createClient();

      // Fetch UPI QR from settings (read-only, unchanged — this is a public setting)
      const { data: settings } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "upi_qr_url")
        .single();
      if (settings?.value) setUpiQr(settings.value as string);

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
          ...data,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to create order");

      setOrderId(body.orderId);
      setOrderNumber(body.orderNumber);
      setStep("payment");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create order. Please try again.");
    }
  };
```

- [ ] **Step 2: Replace `handleScreenshotUpload`**

Replace the entire `handleScreenshotUpload` function (currently at lines 143–173, which uploads directly to Supabase Storage and updates `payments`/`orders` from the browser) with:

```tsx
  const handleScreenshotUpload = async () => {
    if (!screenshot || !orderId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", screenshot);

      const res = await fetch(`/api/checkout/${orderId}/screenshot`, {
        method: "POST",
        body: formData,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to upload screenshot");

      clearCart();
      setStep("confirmation");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload screenshot. Please try again.");
    } finally {
      setUploading(false);
    }
  };
```

- [ ] **Step 3: Verify the typecheck passes and manually smoke-test**

Run: `npm run type-check`
Expected: no errors (note: `router` at line 37 and the `Copy` icon import at line 11 were already unused before this change — leave them as-is, out of scope for this task).

Run: `npm run dev`, add 5+ items to the cart via the UI, go through checkout, and confirm: (1) the order is created via `POST /api/checkout` (check Network tab), (2) uploading a screenshot calls `POST /api/checkout/:orderId/screenshot`, (3) the confirmation screen still renders with the WhatsApp link.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(shop\)/checkout/checkout-client.tsx
git commit -m "refactor: migrate checkout-client.tsx to server-side order creation"
```

---

### Task 12: Migrate `order-status-updater.tsx` to the new API + remove direct "confirmed" transition

**Files:**
- Modify: `src/components/admin/order-status-updater.tsx`
- Modify: `src/app/admin/orders/[id]/page.tsx`

**Interfaces:**
- Consumes: `PATCH /api/admin/orders/:id/status` (Task 9).

**Behavior change (intentional):** today's dropdown lets an admin jump directly to any status including "confirmed" without ever verifying a payment. `OrderService`'s guarded state machine (Task 4) doesn't allow `payment_verification → confirmed` to happen implicitly — it's the same call either way, but "confirmed" should only be reached via the dedicated Payments page's Verify action (Task 10), which also correctly marks the payment as verified. This task removes "Confirmed" from the generic dropdown so the UI stops offering a path that would otherwise 409.

- [ ] **Step 1: Replace `order-status-updater.tsx`**

```tsx
// src/components/admin/order-status-updater.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const statusOptions = [
  { value: "pending", label: "Pending" },
  { value: "payment_verification", label: "Payment Verification" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
];

interface OrderStatusUpdaterProps {
  orderId: string;
  currentStatus: string;
}

export default function OrderStatusUpdater({ orderId, currentStatus }: OrderStatusUpdaterProps) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to update status");

      toast.success("Order status updated");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <h2 className="font-bold mb-4">Update Order Status</h2>
      <p className="text-xs text-muted-foreground mb-3">
        To confirm an order, verify its payment from the{" "}
        <a href="/admin/payments" className="text-primary hover:underline">
          Payments
        </a>{" "}
        page instead.
      </p>
      <div className="flex items-center gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="flex-1 px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm"
        >
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          onClick={handleUpdate}
          disabled={loading || status === currentStatus}
          className="btn-primary text-sm px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {loading ? "Updating..." : "Update Status"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update the caller to drop the removed `paymentId` prop**

In `src/app/admin/orders/[id]/page.tsx`, replace the `OrderStatusUpdater` invocation (currently at lines 125–127):

```tsx
      <OrderStatusUpdater orderId={order.id} currentStatus={order.status} paymentId={
        order.payment ? (order.payment as { id: string }).id : null
      } />
```

with:

```tsx
      <OrderStatusUpdater orderId={order.id} currentStatus={order.status} />
```

- [ ] **Step 3: Run typecheck and the full suite**

Run: `npm run type-check && npm test`
Expected: no errors, all existing tests pass (this component has no dedicated test file today).

- [ ] **Step 4: Manually smoke-test**

Run: `npm run dev`, open an order in `/admin/orders/[id]` whose status is `pending`, confirm the dropdown no longer offers "Confirmed", change it to `payment_verification`, save, and confirm no 409 occurs. Then attempt an invalid jump (e.g. from `pending` directly to `shipped` via the browser devtools Network tab replay or by temporarily re-adding the option) to confirm the route correctly returns 409 — remove any temporary test changes afterward.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/order-status-updater.tsx "src/app/admin/orders/[id]/page.tsx"
git commit -m "refactor: migrate order-status-updater.tsx to guarded status API"
```

---

### Task 13: Remove dead code

**Files:**
- Delete: `src/app/api/orders/route.ts`
- Delete: `src/app/api/setup/` (empty directory)
- Delete: `src/app/auth/redirect/` (duplicate of `src/app/(auth)/redirect/`)

**Interfaces:** None.

- [ ] **Step 1: Confirm the duplicate route group before deleting**

Run: `diff "src/app/auth/redirect/page.tsx" "src/app/(auth)/redirect/page.tsx"` (or read both files if `diff` isn't available on this shell). Only proceed with deletion if they are identical or the `(auth)/redirect` version is a superset — if they've diverged, stop and flag it instead of deleting silently.

- [ ] **Step 2: Delete the dead files**

```bash
rm -f src/app/api/orders/route.ts
rm -rf src/app/api/setup
rm -rf src/app/auth/redirect
```

- [ ] **Step 3: Run the full suite and typecheck**

Run: `npm test && npm run type-check`
Expected: all pass — nothing in the codebase imports from any of the three removed paths (`/api/orders` was already dead/unused per the architecture audit; `/api/setup` was an empty directory with no route file; `(auth)/redirect` is the route Next.js actually serves for `/auth/redirect` since route groups don't add a URL segment).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove dead /api/orders route, empty /api/setup, and duplicate auth/redirect"
```

---

### Task 14: Phase 1 verification and TASKS.md/CHANGELOG.md/ROADMAP.md sync

**Files:**
- Modify: `TASKS.md`
- Modify: `CHANGELOG.md`
- Modify: `ROADMAP.md`

**Interfaces:** None — verification and documentation-sync task.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all suites pass (Phase 0's suites + everything added in Tasks 2–10 of this plan).

- [ ] **Step 2: Run the typecheck**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 3: Manually verify against the dev server (requires the Task 1 migration to have been applied to the live Supabase project first)**

Run: `npm run dev`, then place a real test order through the UI end-to-end (5+ items, checkout form, screenshot upload), then in the Supabase dashboard confirm: the new `orders`/`order_items`/`payments` rows exist with server-computed prices matching the real product prices (not anything a client could have sent), and the ordered products' `reserved_quantity` incremented by the ordered amounts. Then, as an admin, verify the payment via `/admin/payments` and confirm the order's `stock_quantity` decrements and `reserved_quantity` returns to its pre-order value.

- [ ] **Step 4: Update `TASKS.md`**

Add a new entry under a "Phase 1 — Checkout/Order/Payment/Inventory Integrity" heading marking as complete: RLS tightening, `create_order`/`consume_reservation`/`release_reservation` RPCs, reservation-expiry cron, `MediaService` payments namespace + signed URLs, `InventoryService`, `OrderService` (guarded transitions), `PaymentService`, `CheckoutService`, the new checkout/payment/order-status API routes, the `/admin/payments` page, and removal of the dead `/api/orders` route.

- [ ] **Step 5: Update `CHANGELOG.md`**

Add a dated entry (today's date) summarizing: checkout now creates orders server-side with real, re-derived prices (closing the price-tampering gap); order status transitions are now guarded; payment verification/rejection now properly manages stock reservations; payment screenshots use signed URLs from a genuinely private bucket; a scheduled job auto-releases stale reservations.

- [ ] **Step 6: Update `ROADMAP.md`**

Change Phase 1's status from "Not started" to "Complete".

- [ ] **Step 7: Commit**

```bash
git add TASKS.md CHANGELOG.md ROADMAP.md
git commit -m "docs: sync TASKS.md, CHANGELOG.md, ROADMAP.md after Phase 1"
```
