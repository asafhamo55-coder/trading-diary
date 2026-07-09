import type { Metadata, Viewport } from "next";
import "./globals.css";
import InstallBanner from "@/components/layout/InstallBanner";
import BiometricGate from "@/components/auth/BiometricGate";

export const metadata: Metadata = {
  title: "Hamo Home Equity",
  description: "Consolidated equity across Hamo Trade, Properties & Home",
  applicationName: "Hamo Home Equity",
  appleWebApp: {
    capable: true,
    title: "Hamo Home Equity",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0C0F14",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)] safe-area">
        <BiometricGate>
          {children}
          <InstallBanner />
        </BiometricGate>
      </body>
    </html>
  );
}
