import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden print:block print:h-auto print:overflow-visible">
      <div className="print:hidden flex">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden print:block print:overflow-visible">
        <div className="print:hidden">
          <Header />
        </div>
        <main className="flex-1 overflow-y-auto p-6 print:block print:h-auto print:overflow-visible print:p-0">{children}</main>
      </div>
    </div>
  );
}
