"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, MapPin, X, Check } from "lucide-react";
import { INDIAN_STATES } from "@/lib/utils";

const addressSchema = z.object({
  label: z.string().min(1, "Label required"),
  name: z.string().min(2, "Name required"),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian mobile number"),
  street: z.string().min(5, "Street address required"),
  city: z.string().min(2, "City required"),
  state: z.string().min(2, "State required"),
  pincode: z.string().regex(/^\d{6}$/, "Pincode must be 6 digits"),
  is_default: z.boolean(),
});

type AddressFormData = z.infer<typeof addressSchema>;

interface Address {
  id: string;
  label: string;
  name: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
  user_id: string;
}

export default function AddressesPage() {
  const router = useRouter();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);

  const form = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      label: "Home",
      name: "",
      phone: "",
      street: "",
      city: "",
      state: "",
      pincode: "",
      is_default: false,
    },
  });

  const fetchAddresses = async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false });
    setAddresses(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAddresses();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAdd = () => {
    form.reset({
      label: "Home",
      name: "",
      phone: "",
      street: "",
      city: "",
      state: "",
      pincode: "",
      is_default: addresses.length === 0,
    });
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (addr: Address) => {
    form.reset({
      label: addr.label,
      name: addr.name,
      phone: addr.phone,
      street: addr.street,
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
      is_default: addr.is_default,
    });
    setEditing(addr);
    setShowForm(true);
  };

  const onSubmit = async (data: AddressFormData) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    // If marking as default, unset other defaults first
    if (data.is_default) {
      await db
        .from("addresses")
        .update({ is_default: false })
        .eq("user_id", user.id);
    }

    if (editing) {
      const { error } = await db
        .from("addresses")
        .update({ ...data })
        .eq("id", editing.id);
      if (error) {
        toast.error("Failed to update address");
        return;
      }
      toast.success("Address updated");
    } else {
      const { error } = await db.from("addresses").insert([
        { ...data, user_id: user.id },
      ]);
      if (error) {
        toast.error("Failed to save address");
        return;
      }
      toast.success("Address added");
    }
    setShowForm(false);
    fetchAddresses();
  };

  const handleDelete = async (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (createClient() as any)
      .from("addresses")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Failed to delete");
      return;
    }
    toast.success("Address deleted");
    fetchAddresses();
  };

  const setDefault = async (id: string) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    await db
      .from("addresses")
      .update({ is_default: false })
      .eq("user_id", user.id);
    await db.from("addresses").update({ is_default: true }).eq("id", id);
    toast.success("Default address updated");
    fetchAddresses();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-32 rounded-2xl bg-muted animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">My Addresses</h1>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 text-sm py-2 px-4">
          <Plus className="w-4 h-4" />
          Add Address
        </button>
      </div>

      {/* Address form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">
                {editing ? "Edit Address" : "Add New Address"}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="p-1 rounded-lg hover:bg-accent"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Label *
                  </label>
                  <select
                    {...form.register("label")}
                    className="w-full px-3 py-2.5 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm"
                  >
                    <option>Home</option>
                    <option>Work</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer text-sm pb-1">
                    <input
                      type="checkbox"
                      {...form.register("is_default")}
                      className="accent-primary"
                    />
                    Set as default
                  </label>
                </div>
              </div>

              {[
                { name: "name" as const, label: "Full Name *", placeholder: "Arjun Sharma" },
                { name: "phone" as const, label: "Phone Number *", placeholder: "9876543210" },
                { name: "street" as const, label: "Street Address *", placeholder: "123, MG Road, Apt 4B" },
                { name: "city" as const, label: "City *", placeholder: "Mumbai" },
                { name: "pincode" as const, label: "Pincode *", placeholder: "400001" },
              ].map((f) => (
                <div key={f.name}>
                  <label className="block text-sm font-medium mb-1.5">
                    {f.label}
                  </label>
                  <input
                    {...form.register(f.name)}
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2.5 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm"
                  />
                  {form.formState.errors[f.name] && (
                    <p className="text-red-500 text-xs mt-1">
                      {form.formState.errors[f.name]?.message}
                    </p>
                  )}
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  State *
                </label>
                <select
                  {...form.register("state")}
                  className="w-full px-3 py-2.5 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm"
                >
                  <option value="">Select state</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {form.formState.errors.state && (
                  <p className="text-red-500 text-xs mt-1">
                    {form.formState.errors.state.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="w-full btn-primary py-3 mt-2 disabled:opacity-70"
              >
                {form.formState.isSubmitting
                  ? "Saving..."
                  : editing
                    ? "Update Address"
                    : "Save Address"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Address list */}
      {addresses.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <MapPin className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium mb-2">No addresses saved yet</p>
          <button onClick={openAdd} className="btn-primary text-sm py-2 px-5">
            Add Your First Address
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className={`bg-card border rounded-2xl p-5 ${
                addr.is_default
                  ? "border-primary"
                  : "border-border"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wide bg-accent px-2 py-0.5 rounded-full">
                    {addr.label}
                  </span>
                  {addr.is_default && (
                    <span className="text-xs font-semibold text-primary flex items-center gap-1">
                      <Check className="w-3 h-3" /> Default
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!addr.is_default && (
                    <button
                      onClick={() => setDefault(addr.id)}
                      className="text-xs px-2 py-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Set Default
                    </button>
                  )}
                  <button
                    onClick={() => openEdit(addr)}
                    className="p-1.5 rounded-lg hover:bg-accent transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => handleDelete(addr.id)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </div>
              </div>
              <div className="text-sm text-muted-foreground space-y-0.5">
                <p className="font-semibold text-foreground">{addr.name}</p>
                <p>{addr.phone}</p>
                <p>{addr.street}</p>
                <p>
                  {addr.city}, {addr.state} — {addr.pincode}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
