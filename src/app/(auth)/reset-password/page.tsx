"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Lock } from "lucide-react";

const schema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [done, setDone] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });

  const onSubmit = async (data: FormData) => {
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: data.password }),
    });
    if (!res.ok) {
      toast.error("Failed to update password. The reset link may have expired.");
      return;
    }
    setDone(true);
    toast.success("Password updated successfully!");
    setTimeout(() => router.push("/login"), 2000);
  };

  if (done) {
    return (
      <div className="flex flex-col items-center text-center max-w-md mx-auto px-4 py-12">
        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-5">
          <Lock className="w-8 h-8 text-green-500" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Password Updated!</h1>
        <p className="text-muted-foreground">Redirecting you to login...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Set New Password
        </h1>
        <p className="text-muted-foreground text-sm">
          Choose a strong password for your account.
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">
            New Password *
          </label>
          <input
            {...form.register("password")}
            type="password"
            placeholder="At least 8 characters"
            className="w-full px-4 py-3 rounded-xl bg-accent border border-border focus:border-primary focus:outline-none text-sm"
          />
          {form.formState.errors.password && (
            <p className="text-red-500 text-xs mt-1">
              {form.formState.errors.password.message}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Confirm Password *
          </label>
          <input
            {...form.register("confirm")}
            type="password"
            placeholder="Re-enter your password"
            className="w-full px-4 py-3 rounded-xl bg-accent border border-border focus:border-primary focus:outline-none text-sm"
          />
          {form.formState.errors.confirm && (
            <p className="text-red-500 text-xs mt-1">
              {form.formState.errors.confirm.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="w-full btn-primary py-3 disabled:opacity-70"
        >
          {form.formState.isSubmitting ? "Updating..." : "Update Password"}
        </button>
      </form>
    </div>
  );
}
