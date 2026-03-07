"use client";

import { type ReactNode } from "react";
import { seedDemoCubiertas } from "@/lib/seed-demo-cubiertas";
import { seedDemoImportador } from "@/lib/seed-demo-importador";

/**
 * Module-level side effect: runs when the client bundle loads,
 * BEFORE React hydration and any provider useEffect.
 * This guarantees localStorage is seeded before any provider reads it.
 */
if (typeof window !== "undefined") {
  try {
    const raw = localStorage.getItem("freia_user");
    console.log("[DemoSeedGate] module-level check, freia_user:", raw ? JSON.parse(raw).email : "none");
    if (raw) {
      const user = JSON.parse(raw);
      if (user?.email === "demo@freia.ai") {
        const seeded = seedDemoCubiertas();
        console.log("[DemoSeedGate] seedDemoCubiertas returned:", seeded);
        if (seeded) {
          window.location.reload();
        }
      }
      if (user?.email === "importador@freia.ai") {
        const seeded = seedDemoImportador();
        console.log("[DemoSeedGate] seedDemoImportador returned:", seeded);
        if (seeded) {
          window.location.reload();
        }
      }
    }
  } catch (err) {
    console.error("[DemoSeedGate] error:", err);
  }
}

export function DemoSeedGate({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
