"use client";

import { useEffect } from "react";
import { testSupabaseConnection } from "@/lib/supabase";

export function SupabaseConnectionCheck() {
  useEffect(() => {
    void testSupabaseConnection().catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : "Connexion Supabase impossible.");
    });
  }, []);

  return null;
}
