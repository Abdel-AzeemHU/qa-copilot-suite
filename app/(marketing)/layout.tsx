import { auth } from "@/auth";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const loggedIn = Boolean(session?.user);

  return (
    <div className="marketing flex min-h-screen flex-col bg-[#0a0b14] text-slate-100 antialiased">
      <MarketingNav loggedIn={loggedIn} />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
