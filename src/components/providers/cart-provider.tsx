"use client";

import { useEffect } from "react";
import { useCartStore } from "@/store/cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Hydrate cart from localStorage on mount
    useCartStore.persist.rehydrate();
  }, []);

  return <>{children}</>;
}
