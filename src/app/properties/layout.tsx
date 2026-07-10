import { Building2 } from "lucide-react";
import AppBar from "@/components/layout/AppBar";

export default function PropertiesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col min-h-screen">
      <AppBar title="Properties" icon={Building2} accent="#FFB547" />
      <main className="flex-1">{children}</main>
    </div>
  );
}
