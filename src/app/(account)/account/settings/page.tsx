"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

const profileSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number")
    .or(z.literal("")),
});

const passwordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export default function AccountSettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: "", phone: "" },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  useEffect(() => {
    const init = async () => {
      const res = await fetch("/api/account/profile");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (res.ok) {
        const profile = await res.json();
        setEmail(profile.email ?? "");
        profileForm.reset({
          full_name: profile.full_name ?? "",
          phone: profile.phone ?? "",
        });
      }
      setLoading(false);
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSaveProfile = async (data: ProfileFormData) => {
    const res = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: data.full_name, phone: data.phone || null }),
    });
    if (!res.ok) {
      toast.error("Failed to update profile");
      return;
    }
    toast.success("Profile updated");
  };

  const onChangePassword = async (data: PasswordFormData) => {
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: data.password }),
    });
    if (!res.ok) {
      toast.error("Failed to change password");
      return;
    }
    toast.success("Password changed successfully");
    passwordForm.reset();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-48 rounded-2xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Account Settings</h1>

      {/* Profile info */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h2 className="font-bold mb-4">Profile Information</h2>
        <form
          onSubmit={profileForm.handleSubmit(onSaveProfile)}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-sm text-muted-foreground cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Email cannot be changed.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Full Name *
            </label>
            <input
              {...profileForm.register("full_name")}
              placeholder="Arjun Sharma"
              className="w-full px-3 py-2.5 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm"
            />
            {profileForm.formState.errors.full_name && (
              <p className="text-red-500 text-xs mt-1">
                {profileForm.formState.errors.full_name.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Phone Number
            </label>
            <input
              {...profileForm.register("phone")}
              placeholder="9876543210"
              className="w-full px-3 py-2.5 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm"
            />
            {profileForm.formState.errors.phone && (
              <p className="text-red-500 text-xs mt-1">
                {profileForm.formState.errors.phone.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={profileForm.formState.isSubmitting}
            className="btn-primary py-2.5 px-6 disabled:opacity-70"
          >
            {profileForm.formState.isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>

      {/* Change password */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h2 className="font-bold mb-4">Change Password</h2>
        <form
          onSubmit={passwordForm.handleSubmit(onChangePassword)}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium mb-1.5">
              New Password *
            </label>
            <input
              {...passwordForm.register("password")}
              type="password"
              placeholder="At least 8 characters"
              className="w-full px-3 py-2.5 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm"
            />
            {passwordForm.formState.errors.password && (
              <p className="text-red-500 text-xs mt-1">
                {passwordForm.formState.errors.password.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Confirm Password *
            </label>
            <input
              {...passwordForm.register("confirm")}
              type="password"
              placeholder="Re-enter new password"
              className="w-full px-3 py-2.5 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm"
            />
            {passwordForm.formState.errors.confirm && (
              <p className="text-red-500 text-xs mt-1">
                {passwordForm.formState.errors.confirm.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={passwordForm.formState.isSubmitting}
            className="btn-primary py-2.5 px-6 disabled:opacity-70"
          >
            {passwordForm.formState.isSubmitting
              ? "Updating..."
              : "Change Password"}
          </button>
        </form>
      </div>

      {/* Danger zone */}
      <div className="bg-card border border-red-500/20 rounded-2xl p-5">
        <h2 className="font-bold mb-1 text-red-500">Danger Zone</h2>
        <p className="text-sm text-muted-foreground mb-4">
          These actions are permanent and cannot be undone.
        </p>
        <button
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            router.push("/");
            toast.success("Signed out");
          }}
          className="px-5 py-2.5 rounded-xl border border-red-500/30 text-red-500 text-sm font-semibold hover:bg-red-500/10 transition-colors"
        >
          Sign Out of All Devices
        </button>
      </div>
    </div>
  );
}
