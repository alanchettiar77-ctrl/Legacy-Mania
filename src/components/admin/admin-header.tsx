"use client";

import { useRouter } from "next/navigation";
import { Bell, LogOut, User } from "lucide-react";
import { toast } from "sonner";

export default function AdminHeader() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Logged out");
    router.push("/login");
  };

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 flex-shrink-0">
      <div>
        <p className="text-sm text-muted-foreground">Admin Panel</p>
      </div>
      <div className="flex items-center gap-2">
        <button className="p-2 rounded-lg hover:bg-accent transition-colors relative">
          <Bell className="w-4 h-4 text-muted-foreground" />
        </button>
        <button className="p-2 rounded-lg hover:bg-accent transition-colors">
          <User className="w-4 h-4 text-muted-foreground" />
        </button>
        <button
          onClick={handleLogout}
          className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-500 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
