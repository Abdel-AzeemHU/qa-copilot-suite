import Link from "next/link";
import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link href="/dashboard" className="font-semibold">
          Qaera
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/settings"
            className="text-sm text-neutral-600 hover:text-neutral-900"
          >
            Settings
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
