import type { Metadata, Viewport } from "next";
import { PWARegister } from "@/components/PWARegister";
import { SupabaseConnectionCheck } from "@/components/SupabaseConnectionCheck";
import "./globals.css";

export const metadata: Metadata = {
  title: "Financiero",
  description: "Application personnelle pour gerer revenus, depenses, factures, patrimoine et budgets.",
  applicationName: "Financiero",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/financiero-icon.svg",
    apple: "/apple-touch-icon.svg",
  },
  appleWebApp: {
    capable: true,
    title: "Financiero",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#2563eb",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className="antialiased">
      <body>
        <PWARegister />
        <SupabaseConnectionCheck />
        {children}
      </body>
    </html>
  );
}
