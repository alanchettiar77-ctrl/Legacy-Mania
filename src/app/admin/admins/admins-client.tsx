"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Shield, Trash2, Plus, Loader2, UserCheck } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Admin {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

export default function AdminsClient({
  initialAdmins,
  currentUserId,
  ownerEmail,
}: {
  initialAdmins: Admin[];
  currentUserId: string;
  ownerEmail: string;
}) {
  const [admins, setAdmins] = useState(initialAdmins);
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!email.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to add admin");
        return;
      }
      setAdmins((prev) => [...prev, data]);
      setEmail("");
      toast.success(`${data.email} is now an admin`);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: string, adminEmail: string) => {
    setRemovingId(id);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to remove admin");
        return;
      }
      setAdmins((prev) => prev.filter((a) => a.id !== id));
      toast.success(`${adminEmail} removed from admins`);
    } finally {
      setRemovingId(null);
    }
  };

  const initials = (admin: Admin) => {
    if (admin.full_name) {
      return admin.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return admin.email[0].toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Add admin */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="font-bold text-foreground mb-1">Add Admin</h2>
        <p className="text-sm text-muted-foreground mb-4">
          The person must already have an account on the store. Enter their email to grant admin access.
        </p>
        <div className="flex gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Enter email address..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-background border border-border focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !email.trim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add Admin
          </button>
        </div>
      </div>

      {/* Current admins */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <h2 className="font-bold text-foreground">Current Admins</h2>
          <span className="ml-auto bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
            {admins.length}
          </span>
        </div>

        <div className="divide-y divide-border">
          {admins.map((admin) => {
            const isYou = admin.id === currentUserId;
            const isOwner = admin.email === ownerEmail;
            const isRemoving = removingId === admin.id;
            return (
              <div key={admin.id} className="flex items-center gap-4 px-6 py-4">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                  {initials(admin)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {admin.full_name ?? admin.email}
                    </p>
                    {isOwner && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full">
                        <Shield className="w-3 h-3" />
                        Owner
                      </span>
                    )}
                    {isYou && !isOwner && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        <UserCheck className="w-3 h-3" />
                        You
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{admin.email}</p>
                  <p className="text-xs text-muted-foreground">Added {formatDate(admin.created_at)}</p>
                </div>

                {/* Remove — hidden for owner */}
                {!isYou && !isOwner && (
                  <button
                    onClick={() => handleRemove(admin.id, admin.email)}
                    disabled={isRemoving}
                    className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    title="Remove admin access"
                  >
                    {isRemoving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
