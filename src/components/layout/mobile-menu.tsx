"use client";

import Link from "next/link";
import { X, Home, BookOpen, Info, User, Search, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

const menuLinks = [
  { href: "/", label: "Home", icon: Home },
  { href: "/catalog", label: "Catalog", icon: BookOpen },
  { href: "/about", label: "About", icon: Info },
  { href: "/search", label: "Search", icon: Search },
  { href: "/account", label: "My Account", icon: User },
  { href: "/account/wishlist", label: "Wishlist", icon: Heart },
];

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed top-0 right-0 bottom-0 z-50 w-72 bg-background border-l border-border shadow-2xl transition-transform duration-300",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <span className="font-bold text-lg">
              Legacy<span className="text-primary">Mania</span>
            </span>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-accent transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-1">
              {menuLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={onClose}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-colors font-medium"
                  >
                    <link.icon className="w-5 h-5" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="p-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Collect The Stories That Shaped Generations
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
