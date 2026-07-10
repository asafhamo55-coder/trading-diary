import { Home as HomeIcon } from "lucide-react";
import AppBar from "@/components/layout/AppBar";
import HomeTabBar from "@/components/home/HomeTabBar";

export default function HomeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col min-h-screen">
      <AppBar title="Home" icon={HomeIcon} accent="#00D68F" />
      <main className="flex-1 pb-[calc(3.75rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </main>
      <HomeTabBar />
    </div>
  );
}
