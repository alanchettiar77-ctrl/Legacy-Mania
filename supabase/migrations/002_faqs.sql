-- ============================================================
-- FAQS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.faqs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active faqs" ON public.faqs
  FOR SELECT USING (is_active = TRUE);

CREATE TRIGGER update_faqs_updated_at BEFORE UPDATE ON public.faqs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed FAQ content
INSERT INTO public.faqs (question, answer, display_order) VALUES
  ('What products does Legacy Mania sell?', 'Legacy Mania specializes in authentic collectible trading cards, anime merchandise, gaming collectibles, and pop culture memorabilia.', 0),
  ('Are all your products genuine?', 'Yes. Every product listed on Legacy Mania is carefully sourced and inspected before being listed for sale.', 1),
  ('Do you offer Cash on Delivery (COD)?', 'Currently, we only accept prepaid payments through supported payment methods.', 2),
  ('What payment methods do you accept?', 'We currently accept UPI payments and other payment methods that are displayed during checkout.', 3),
  ('How long does shipping take?', 'Orders are generally processed within 1-3 business days. Delivery timelines depend on your location and courier service.', 4),
  ('Can I cancel my order?', 'Orders can only be cancelled before they have been packed or dispatched. Please contact us immediately if you wish to cancel.', 5),
  ('Do you accept returns or refunds?', 'As Legacy Mania is an early-stage startup, we currently do not offer standard returns or refunds once an order has been placed. However, customer satisfaction is extremely important to us. If you have received the wrong item, a damaged product, or have any concerns regarding your order, please contact us directly on WhatsApp. Every request will be reviewed individually, and our team will do our best to assist you on a case-by-case basis.', 6),
  ('How can I contact Legacy Mania?', 'You can reach us through our Contact Us page or directly via WhatsApp for faster assistance.', 7),
  ('Are your trading cards original?', 'Yes. Product authenticity will always be mentioned in the product listing wherever applicable.', 8),
  ('Do you restock sold-out products?', 'Popular products may be restocked depending on supplier availability. Follow our social media channels for updates.', 9),
  ('Can I request specific collectibles?', 'Absolutely. Reach out to us through WhatsApp, and we''ll try our best to source the collectible you''re looking for.', 10),
  ('How can I stay updated?', 'Follow Legacy Mania on Instagram, Facebook, and YouTube for the latest launches, offers, and collectibles.', 11);
