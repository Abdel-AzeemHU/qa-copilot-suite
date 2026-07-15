import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`group flex items-center gap-2.5 ${className}`}>
      <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-emerald-400 shadow-lg shadow-indigo-500/30 transition-transform group-hover:scale-105">
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5 text-white"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12a9 9 0 1 1-3-6.7" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-white">
        Qaera
      </span>
    </Link>
  );
}
