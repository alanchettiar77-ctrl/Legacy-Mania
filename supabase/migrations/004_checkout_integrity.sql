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
