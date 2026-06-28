"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle, ChevronRight, Copy, CheckCircle,
  Upload, ShoppingCart, ArrowLeft
} from "lucide-react";
import { useCartStore } from "@/store/cart";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, INDIAN_STATES, generateOrderNumber, getWhatsAppUrl, getOrderWhatsAppMessage } from "@/lib/utils";
import { toast } from "sonner";

const MIN_QTY = 5;

const checkoutSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian mobile number"),
  address: z.string().min(10, "Please enter a complete address"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(1, "State is required"),
  pincode: z.string().regex(/^\d{6}$/, "Invalid pincode"),
  notes: z.string().optional(),
});

type CheckoutFormData = z.infer<typeof checkoutSchema>;

type Step = "details" | "payment" | "confirmation";

export default function CheckoutClient() {
  const router = useRouter();
  const { items, totalItems, totalPrice, clearCart } = useCartStore();
  const count = totalItems();
  const price = totalPrice();
  const [step, setStep] = useState<Step>("details");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [upiQr, setUpiQr] = useState<string | null>(null);

  const form = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
  });

  // Guard: minimum order qty
  if (count < MIN_QTY) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md text-center">
          <ShoppingCart className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Minimum Order Not Met</h1>
          <div className="flex items-start gap-2 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-600 dark:text-yellow-400 mb-6 text-left">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <p className="text-sm">
              <strong>Minimum order quantity is 5 cards.</strong>
              <br />
              You currently have {count} card{count !== 1 ? "s" : ""} in your cart. Please add{" "}
              {MIN_QTY - count} more to proceed.
            </p>
          </div>
          <Link href="/catalog" className="btn-primary">
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  const onSubmitDetails = async (data: CheckoutFormData) => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      // Fetch UPI QR from settings
      const { data: settings } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "upi_qr_url")
        .single();
      if (settings?.value) setUpiQr(settings.value as string);

      const orderNum = generateOrderNumber();
      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          order_number: orderNum,
          user_id: user?.id || null,
          guest_email: !user ? data.email : null,
          status: "pending",
          subtotal: price,
          shipping_cost: 0,
          total: price,
          shipping_name: data.name,
          shipping_email: data.email,
          shipping_phone: data.phone,
          shipping_address: data.address,
          shipping_city: data.city,
          shipping_state: data.state,
          shipping_pincode: data.pincode,
          notes: data.notes || null,
        })
        .select()
        .single();

      if (error || !order) throw error;

      // Insert order items
      await supabase.from("order_items").insert(
        items.map((item) => ({
          order_id: order.id,
          product_id: item.productId,
          product_name: item.name,
          product_image: item.image,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.price * item.quantity,
        }))
      );

      // Create payment record
      await supabase.from("payments").insert({
        order_id: order.id,
        amount: price,
        payment_method: "upi",
        status: "pending",
      });

      setOrderId(order.id);
      setOrderNumber(orderNum);
      setStep("payment");
    } catch {
      toast.error("Failed to create order. Please try again.");
    }
  };

  const handleScreenshotUpload = async () => {
    if (!screenshot || !orderId) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = screenshot.name.split(".").pop();
      const path = `payment-screenshots/${orderId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("payments")
        .upload(path, screenshot, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("payments").getPublicUrl(path);

      await supabase.from("payments").update({
        screenshot_url: publicUrl,
        status: "pending",
      }).eq("order_id", orderId);

      await supabase.from("orders").update({ status: "payment_verification" }).eq("id", orderId);

      clearCart();
      setStep("confirmation");
    } catch {
      toast.error("Failed to upload screenshot. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  if (step === "confirmation") {
    const phone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "919876543210";
    const whatsappUrl = getWhatsAppUrl(phone, getOrderWhatsAppMessage(orderNumber!));

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-lg text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Order Placed!</h1>
          <p className="text-muted-foreground mb-1">
            Order Number: <span className="font-bold text-foreground">{orderNumber}</span>
          </p>
          <p className="text-muted-foreground mb-8 text-sm">
            We&apos;re verifying your payment. We&apos;ll update you via WhatsApp once confirmed.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-[#25D366] text-white font-bold px-6 py-3 rounded-xl"
            >
              Confirm via WhatsApp
            </a>
            <Link href="/account/orders" className="btn-secondary text-center">
              View Orders
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (step === "payment") {
    return (
      <div className="min-h-screen bg-background py-12">
        <div className="container-max px-4 md:px-8 max-w-2xl">
          <h1 className="text-3xl font-bold text-foreground mb-2">Complete Payment</h1>
          <p className="text-muted-foreground mb-8">
            Scan the UPI QR code and upload your payment screenshot
          </p>

          <div className="space-y-6">
            {/* QR Code */}
            <div className="bg-card border border-border rounded-2xl p-6 text-center">
              <h2 className="font-bold text-lg mb-4">Pay via UPI</h2>
              {upiQr ? (
                <Image
                  src={upiQr}
                  alt="UPI QR Code"
                  width={200}
                  height={200}
                  className="mx-auto rounded-xl mb-4"
                />
              ) : (
                <div className="w-48 h-48 mx-auto bg-muted rounded-xl flex items-center justify-center mb-4">
                  <p className="text-xs text-muted-foreground">UPI QR Code</p>
                </div>
              )}
              <p className="text-2xl font-bold text-primary mb-1">
                {formatCurrency(price)}
              </p>
              <p className="text-xs text-muted-foreground">Total Amount to Pay</p>
            </div>

            {/* Upload screenshot */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="font-bold text-lg mb-4">Upload Payment Screenshot</h2>
              <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-border rounded-xl p-8 cursor-pointer hover:border-primary/50 hover:bg-accent/20 transition-colors">
                <Upload className="w-8 h-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground text-center">
                  {screenshot ? screenshot.name : "Click to upload payment screenshot"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
                />
              </label>

              <button
                onClick={handleScreenshotUpload}
                disabled={!screenshot || uploading}
                className="mt-4 w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? "Uploading..." : "Submit Payment Screenshot"}
              </button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Order ID: {orderNumber}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container-max px-4 md:px-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/catalog" className="p-2 rounded-lg hover:bg-accent transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Checkout</h1>
            <div className="flex items-center gap-2 mt-1">
              {(["details", "payment", "confirmation"] as Step[]).map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                  <span className={`text-xs font-medium capitalize ${s === step ? "text-primary" : "text-muted-foreground"}`}>
                    {s === "details" ? "Your Details" : s === "payment" ? "Payment" : "Confirmation"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-2">
            <form onSubmit={form.handleSubmit(onSubmitDetails)} className="space-y-4">
              <div className="bg-card border border-border rounded-2xl p-6">
                <h2 className="font-bold text-lg mb-5">Delivery Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { name: "name" as const, label: "Full Name", placeholder: "Arjun Sharma", colSpan: false },
                    { name: "email" as const, label: "Email Address", placeholder: "arjun@email.com", colSpan: false },
                    { name: "phone" as const, label: "Mobile Number", placeholder: "9876543210", colSpan: false },
                    { name: "address" as const, label: "Full Address", placeholder: "Flat No, Street, Area...", colSpan: true },
                    { name: "city" as const, label: "City", placeholder: "Mumbai", colSpan: false },
                    { name: "pincode" as const, label: "Pincode", placeholder: "400001", colSpan: false },
                  ].map((field) => (
                    <div key={field.name} className={field.colSpan ? "md:col-span-2" : ""}>
                      <label className="block text-sm font-medium text-foreground mb-1.5">
                        {field.label}
                      </label>
                      {field.colSpan ? (
                        <textarea
                          {...form.register(field.name)}
                          placeholder={field.placeholder}
                          rows={2}
                          className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm resize-none"
                        />
                      ) : (
                        <input
                          {...form.register(field.name)}
                          placeholder={field.placeholder}
                          className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                        />
                      )}
                      {form.formState.errors[field.name] && (
                        <p className="text-red-500 text-xs mt-1">
                          {form.formState.errors[field.name]?.message}
                        </p>
                      )}
                    </div>
                  ))}

                  {/* State select */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">State</label>
                    <select
                      {...form.register("state")}
                      className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                    >
                      <option value="">Select State</option>
                      {INDIAN_STATES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    {form.formState.errors.state && (
                      <p className="text-red-500 text-xs mt-1">
                        {form.formState.errors.state.message}
                      </p>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Order Notes (Optional)
                    </label>
                    <textarea
                      {...form.register("notes")}
                      placeholder="Any special instructions..."
                      rows={2}
                      className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm resize-none"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="w-full btn-primary text-base py-4 disabled:opacity-70"
              >
                {form.formState.isSubmitting ? "Placing Order..." : "Place Order & Continue to Payment"}
              </button>
            </form>
          </div>

          {/* Order summary */}
          <div>
            <div className="bg-card border border-border rounded-2xl p-6 sticky top-24">
              <h2 className="font-bold text-lg mb-4">Order Summary</h2>
              <div className="space-y-3 mb-4">
                {items.map((item) => (
                  <div key={item.productId} className="flex gap-3">
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      {item.image && (
                        <Image src={item.image} alt={item.name} fill className="object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                    <span className="text-sm font-semibold whitespace-nowrap">
                      {formatCurrency(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal ({count} items)</span>
                  <span>{formatCurrency(price)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="text-green-500">Free</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t border-border pt-2 mt-2">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(price)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
