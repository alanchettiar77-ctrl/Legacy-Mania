"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { slugify } from "@/lib/utils";
import { toast } from "sonner";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().optional(),
  parent_id: z.string().optional(),
  display_order: z.coerce.number().default(0),
  is_active: z.boolean().default(true),
  meta_title: z.string().optional(),
  meta_description: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface ParentOption {
  id: string;
  name: string;
}

interface CategoryFormProps {
  parentCategories: ParentOption[];
  /** Category ids to hide from the parent dropdown — always includes the category's own id and every descendant, so an edit can never create a cycle from the UI. */
  excludeCategoryIds: string[];
  initialData?: Partial<FormData> & { id?: string };
}

export default function CategoryForm({ parentCategories, excludeCategoryIds, initialData }: CategoryFormProps) {
  const router = useRouter();
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initialData?.name ?? "",
      slug: initialData?.slug ?? "",
      description: initialData?.description ?? "",
      parent_id: initialData?.parent_id ?? "",
      display_order: initialData?.display_order ?? 0,
      is_active: initialData?.is_active ?? true,
      meta_title: initialData?.meta_title ?? "",
      meta_description: initialData?.meta_description ?? "",
    },
  });

  const selectableParents = parentCategories.filter((p) => !excludeCategoryIds.includes(p.id));

  const onSubmit = async (data: FormData) => {
    const payload = {
      name: data.name,
      slug: data.slug,
      description: data.description ?? null,
      parent_id: data.parent_id || null,
      display_order: data.display_order,
      is_active: data.is_active,
      meta_title: data.meta_title ?? null,
      meta_description: data.meta_description ?? null,
    };

    const res = initialData?.id
      ? await fetch(`/api/admin/categories/${initialData.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/admin/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Failed to save category");
      return;
    }
    toast.success(initialData?.id ? "Category updated" : "Category created");
    router.refresh();
    if (!initialData?.id) form.reset();
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      <div>
        <label htmlFor="category-name" className="block text-sm font-medium mb-1.5">Name *</label>
        <input
          id="category-name"
          {...form.register("name")}
          placeholder="e.g., T-Shirts"
          className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm"
          onChange={(e) => {
            form.setValue("name", e.target.value);
            if (!initialData?.id) form.setValue("slug", slugify(e.target.value));
          }}
        />
        {form.formState.errors.name && (
          <p className="text-red-500 text-xs mt-1">{form.formState.errors.name.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="category-slug" className="block text-sm font-medium mb-1.5">Slug *</label>
        <input
          id="category-slug"
          {...form.register("slug")}
          placeholder="t-shirts"
          className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm font-mono"
        />
      </div>

      <div>
        <label htmlFor="category-parent" className="block text-sm font-medium mb-1.5">Parent Category</label>
        <select
          id="category-parent"
          {...form.register("parent_id")}
          className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm"
        >
          <option value="">No Parent (Top Level)</option>
          {selectableParents.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="category-description" className="block text-sm font-medium mb-1.5">Description</label>
        <textarea
          id="category-description"
          {...form.register("description")}
          rows={2}
          className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm resize-none"
        />
      </div>

      <div>
        <label htmlFor="category-meta-title" className="block text-sm font-medium mb-1.5">Meta Title</label>
        <input
          id="category-meta-title"
          {...form.register("meta_title")}
          placeholder="e.g., Kanto Region Cards — Legacy Mania"
          className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm"
        />
      </div>

      <div>
        <label htmlFor="category-meta-description" className="block text-sm font-medium mb-1.5">Meta Description</label>
        <textarea
          id="category-meta-description"
          {...form.register("meta_description")}
          rows={2}
          className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm resize-none"
        />
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label htmlFor="category-display-order" className="block text-sm font-medium mb-1.5">Display Order</label>
          <input
            id="category-display-order"
            {...form.register("display_order")}
            type="number"
            min="0"
            className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer mt-6">
          <input {...form.register("is_active")} type="checkbox" className="w-4 h-4 accent-primary" />
          <span className="text-sm font-medium">Active</span>
        </label>
      </div>

      <button
        type="submit"
        disabled={form.formState.isSubmitting}
        className="w-full btn-primary py-3 text-sm disabled:opacity-70"
      >
        {form.formState.isSubmitting
          ? "Saving..."
          : initialData?.id
          ? "Update Category"
          : "Add Category"}
      </button>
    </form>
  );
}
