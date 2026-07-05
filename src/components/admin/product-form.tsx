"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/utils";
import { toast } from "sonner";
import { Upload, X, Plus } from "lucide-react";
import Image from "next/image";

const productSchema = z.object({
  name: z.string().min(2, "Name is required"),
  slug: z.string().min(2, "Slug is required"),
  description: z.string().optional(),
  price: z.coerce.number().min(1, "Price must be at least 1"),
  compare_price: z.coerce.number().optional(),
  category_id: z.string().optional(),
  series: z.string().optional(),
  saga: z.string().optional(),
  collection: z.string().optional(),
  stock_quantity: z.coerce.number().min(0),
  sku: z.string().optional(),
  is_active: z.boolean(),
  is_featured: z.boolean(),
  is_new: z.boolean(),
  meta_title: z.string().optional(),
  meta_description: z.string().optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface Category {
  id: string;
  name: string;
  parent_id: string | null;
}

interface ProductFormProps {
  categories: Category[];
  initialData?: Partial<ProductFormData> & { id?: string; images?: string[] };
}

export default function ProductForm({ categories, initialData }: ProductFormProps) {
  const router = useRouter();
  const [images, setImages] = useState<string[]>(initialData?.images ?? []);
  const [uploading, setUploading] = useState(false);

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: initialData?.name ?? "",
      slug: initialData?.slug ?? "",
      description: initialData?.description ?? "",
      price: initialData?.price ?? 0,
      compare_price: initialData?.compare_price,
      category_id: initialData?.category_id ?? "",
      series: initialData?.series ?? "",
      saga: initialData?.saga ?? "",
      collection: initialData?.collection ?? "",
      stock_quantity: initialData?.stock_quantity ?? 0,
      sku: initialData?.sku ?? "",
      is_active: initialData?.is_active ?? true,
      is_featured: initialData?.is_featured ?? false,
      is_new: initialData?.is_new ?? true,
      meta_title: initialData?.meta_title ?? "",
      meta_description: initialData?.meta_description ?? "",
    },
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("namespace", "products");
        const res = await fetch("/api/media/upload", { method: "POST", body: formData });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Upload failed");
        urls.push(body.publicUrl);
      }
      setImages((prev) => [...prev, ...urls]);
      toast.success(`${urls.length} image(s) uploaded`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (data: ProductFormData) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createClient() as any;
      const payload = {
        name: data.name,
        slug: data.slug,
        description: data.description ?? null,
        price: data.price,
        compare_price: data.compare_price ?? null,
        images,
        tags: [] as string[],
        category_id: data.category_id || null,
        series: data.series ?? null,
        saga: data.saga ?? null,
        collection: data.collection ?? null,
        stock_quantity: data.stock_quantity,
        sku: data.sku ?? null,
        is_active: data.is_active,
        is_featured: data.is_featured,
        is_new: data.is_new,
        meta_title: data.meta_title ?? null,
        meta_description: data.meta_description ?? null,
      };

      if (initialData?.id) {
        const { error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", initialData.id);
        if (error) throw error;
        toast.success("Product updated");
      } else {
        const { error } = await supabase.from("products").insert([payload]);
        if (error) throw error;
        toast.success("Product created");
      }
      router.push("/admin/products");
      router.refresh();
    } catch (err) {
      toast.error("Failed to save product");
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main fields */}
        <div className="lg:col-span-2 space-y-5">
          {/* Basic info */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-bold mb-4">Basic Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Product Name *</label>
                <input
                  {...form.register("name")}
                  placeholder="e.g., Charizard Holo Card"
                  className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm"
                  onChange={(e) => {
                    form.setValue("name", e.target.value);
                    if (!initialData?.id) {
                      form.setValue("slug", slugify(e.target.value));
                    }
                  }}
                />
                {form.formState.errors.name && (
                  <p className="text-red-500 text-xs mt-1">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Slug *</label>
                <input
                  {...form.register("slug")}
                  placeholder="charizard-holo-card"
                  className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Description</label>
                <textarea
                  {...form.register("description")}
                  rows={4}
                  placeholder="Product description..."
                  className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm resize-none"
                />
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-bold mb-4">Pricing & Inventory</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Price (₹) *</label>
                <input
                  {...form.register("price")}
                  type="number"
                  min="0"
                  className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm"
                />
                {form.formState.errors.price && (
                  <p className="text-red-500 text-xs mt-1">{form.formState.errors.price.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Compare Price (₹)</label>
                <input
                  {...form.register("compare_price")}
                  type="number"
                  min="0"
                  placeholder="Original price"
                  className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Stock Quantity *</label>
                <input
                  {...form.register("stock_quantity")}
                  type="number"
                  min="0"
                  className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">SKU</label>
                <input
                  {...form.register("sku")}
                  placeholder="SKU-001"
                  className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm"
                />
              </div>
            </div>
          </div>

          {/* Attributes */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-bold mb-4">Product Attributes</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { name: "series" as const, label: "Series", placeholder: "e.g., Original" },
                { name: "saga" as const, label: "Saga", placeholder: "e.g., Indigo League" },
                { name: "collection" as const, label: "Collection", placeholder: "e.g., Base Set" },
              ].map((field) => (
                <div key={field.name}>
                  <label className="block text-sm font-medium mb-1.5">{field.label}</label>
                  <input
                    {...form.register(field.name)}
                    placeholder={field.placeholder}
                    className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* SEO */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-bold mb-4">SEO</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Meta Title</label>
                <input
                  {...form.register("meta_title")}
                  className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Meta Description</label>
                <textarea
                  {...form.register("meta_description")}
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Images */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-bold mb-4">Product Images</h2>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {images.map((url, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-muted">
                  <Image src={url} alt={`Image ${i + 1}`} fill className="object-cover" />
                  <button
                    type="button"
                    onClick={() => setImages(images.filter((_, idx) => idx !== i))}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <label
              htmlFor="product-image-upload"
              className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl p-4 cursor-pointer hover:border-primary/50 transition-colors"
            >
              <Upload className="w-5 h-5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {uploading ? "Uploading..." : "Upload Images"}
              </span>
              <input
                id="product-image-upload"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageUpload}
                disabled={uploading}
              />
            </label>
          </div>

          {/* Category */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-bold mb-4">Category</h2>
            <select
              {...form.register("category_id")}
              className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm"
            >
              <option value="">No Category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.parent_id ? "  └ " : ""}{cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-bold mb-4">Status & Visibility</h2>
            <div className="space-y-3">
              {[
                { name: "is_active" as const, label: "Active (visible on site)" },
                { name: "is_featured" as const, label: "Featured product" },
                { name: "is_new" as const, label: "Mark as New" },
              ].map((field) => (
                <label key={field.name} className="flex items-center gap-3 cursor-pointer">
                  <input
                    {...form.register(field.name)}
                    type="checkbox"
                    className="w-4 h-4 rounded accent-primary"
                  />
                  <span className="text-sm">{field.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="w-full btn-primary py-3 disabled:opacity-70"
          >
            {form.formState.isSubmitting
              ? "Saving..."
              : initialData?.id
              ? "Update Product"
              : "Create Product"}
          </button>
        </div>
      </div>
    </form>
  );
}
