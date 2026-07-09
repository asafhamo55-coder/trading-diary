import Sidebar from "@/components/layout/Sidebar";

export default function TradeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col min-h-screen overflow-x-hidden pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
