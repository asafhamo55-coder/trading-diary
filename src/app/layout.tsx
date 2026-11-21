import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/lib/theme-script";
import InstallBanner from "@/components/layout/InstallBanner";
import BiometricGate from "@/components/auth/BiometricGate";

// Same faces and weights as HomeownerHub (apps/hoa/src/app/layout.tsx).
const beVietnam = Be_Vietnam_Pro({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-be-vietnam",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

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
    <html
      lang="en"
      className={`${beVietnam.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies the saved theme + collapsed sidebar before paint. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)] safe-area">
        <BiometricGate>
          {children}
          <InstallBanner />
        </BiometricGate>
      </body>
    </html>
  );
}
