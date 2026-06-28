"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/utils";
import { toast } from "sonner";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().optional(),
  parent_id: z.string().optional(),
  display_order: z.coerce.number().default(0),
  is_active: z.boolean().default(true),
});
type FormData = z.infer<typeof schema>;

interface Category {
  id: string;
  name: string;
}

interface CategoryFormProps {
  parentCategories: Category[];
  initialData?: Partial<FormData> & { id?: string };
}

export default function CategoryForm({ parentCategories, initialData }: CategoryFormProps) {
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
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createClient() as any;
      const payload = {
        name: data.name,
        slug: data.slug,
        description: data.description ?? null,
        parent_id: data.parent_id || null,
        display_order: data.display_order,
        is_active: data.is_active,
      };
      if (initialData?.id) {
        await supabase.from("categories").update(payload).eq("id", initialData.id);
        toast.success("Category updated");
      } else {
        await supabase.from("categories").insert([payload]);
        toast.success("Category created");
      }
      router.refresh();
      form.reset();
    } catch {
      toast.error("Failed to save category");
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      <div>
        <label className="block text-sm font-medium mb-1.5">Name *</label>
        <input
          {...form.register("name")}
          placeholder="e.g., Pokémon"
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
        <label className="block text-sm font-medium mb-1.5">Slug *</label>
        <input
          {...form.register("slug")}
          placeholder="pokemon"
          className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm font-mono"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Parent Category</label>
        <select
          {...form.register("parent_id")}
          className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm"
        >
          <option value="">No Parent (Top Level)</option>
          {parentCategories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Description</label>
        <textarea
          {...form.register("description")}
          rows={2}
          className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm resize-none"
        />
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1.5">Display Order</label>
          <input
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
