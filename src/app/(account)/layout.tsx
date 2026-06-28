import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import AccountSidebar from "@/components/account/account-sidebar";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-16 bg-background">
        <div className="container-max px-4 md:px-8 py-8">
          <div className="flex flex-col md:flex-row gap-8">
            <AccountSidebar />
            <div className="flex-1 min-w-0">{children}</div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
