"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const [showPwd, setShowPwd] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back!");

    const redirectParam = new URLSearchParams(window.location.search).get("redirect");
    // Go to /admin — middleware allows admins through, redirects customers to /account
    window.location.href = redirectParam ?? "/admin";
  };

  return (
    <div className="w-full max-w-md">
      <div className="bg-card border border-border rounded-2xl p-8 shadow-xl">
        <h1 className="text-2xl font-bold text-foreground mb-1">Welcome back</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-primary hover:underline font-medium">
            Register
          </Link>
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <input
              {...register("email")}
              type="email"
              placeholder="you@email.com"
              className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Password</label>
            <div className="relative">
              <input
                {...register("password")}
                type={showPwd ? "text" : "password"}
                placeholder="••••••••"
                className="w-full px-4 py-3 pr-10 rounded-xl bg-background border border-border focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <div className="text-right">
            <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-primary">
              Forgot password?
            </Link>
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full btn-primary py-3 disabled:opacity-70">
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
