import { ProtectedAppShell } from "@/components/ProtectedAppShell";

export function AppShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <ProtectedAppShell title={title} subtitle={subtitle}>
      {children}
    </ProtectedAppShell>
  );
}
