"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BottomNavigation, Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { useAdminAccessStatus } from "@/lib/admin-access-store";

export function ProtectedAppShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  const router = useRouter();
  const { hasAccess, isChecking } = useAdminAccessStatus();

  useEffect(() => {
    if (!isChecking && !hasAccess) {
      router.replace("/");
    }
  }, [hasAccess, isChecking, router]);

  if (isChecking || !hasAccess) {
    return (
      <div className="grid min-h-screen place-items-center bg-black px-4 text-center text-zinc-300">
        <div>
          <div className="mx-auto mb-4 grid size-11 place-items-center rounded-lg bg-emerald-400 font-black text-black">F</div>
          <p className="text-sm">Verification de l&apos;acces local...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-zinc-950">
      <div className="flex">
        <Sidebar />
        <div className="min-w-0 flex-1">
          <Topbar title={title} subtitle={subtitle} />
          <main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-8">{children}</main>
        </div>
      </div>
      <BottomNavigation />
    </div>
  );
}
