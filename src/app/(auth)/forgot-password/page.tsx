"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: FormData) => {
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setSentEmail(data.email);
    setSent(true);
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center text-center max-w-md mx-auto px-4 py-12">
        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-5">
          <CheckCircle className="w-8 h-8 text-green-500" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Check your inbox</h1>
        <p className="text-muted-foreground mb-1">
          We&apos;ve sent a password reset link to
        </p>
        <p className="font-semibold text-foreground mb-6">{sentEmail}</p>
        <p className="text-sm text-muted-foreground mb-8">
          Didn&apos;t get it? Check your spam folder or{" "}
          <button
            onClick={() => setSent(false)}
            className="text-primary underline"
          >
            try again
          </button>
          .
        </p>
        <Link href="/login" className="btn-primary px-8 py-3">
          Back to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <Link
        href="/login"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Login
      </Link>

      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Mail className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Forgot Password?
        </h1>
        <p className="text-muted-foreground text-sm">
          Enter your email and we&apos;ll send a reset link.
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Email Address
          </label>
          <input
            {...form.register("email")}
            type="email"
            placeholder="you@example.com"
            className="w-full px-4 py-3 rounded-xl bg-accent border border-border focus:border-primary focus:outline-none text-sm"
          />
          {form.formState.errors.email && (
            <p className="text-red-500 text-xs mt-1">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="w-full btn-primary py-3 disabled:opacity-70"
        >
          {form.formState.isSubmitting ? "Sending..." : "Send Reset Link"}
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-6">
        Remember your password?{" "}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
