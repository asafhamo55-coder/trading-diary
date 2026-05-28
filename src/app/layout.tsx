import type { Metadata, Viewport } from "next";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import InstallBanner from "@/components/layout/InstallBanner";

export const metadata: Metadata = {
  title: "Trading Journal Pro",
  description: "Professional trading diary & analytics",
  applicationName: "Trading Journal",
  appleWebApp: {
    capable: true,
    title: "Trading Journal",
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
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
            {children}
          </main>
        </div>
        <InstallBanner />
      </body>
    </html>
  );
}
