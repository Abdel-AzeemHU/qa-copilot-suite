const steps = [
  { label: "Requirement", icon: "M9 12h6m-6 4h6M9 8h6M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" },
  { label: "Test Cases", icon: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" },
  { label: "Code You Own", icon: "m18 16 4-4-4-4M6 8l-4 4 4 4M14.5 4l-5 16" },
  { label: "Live Run", icon: "M8 5v14l11-7z" },
  { label: "Heal & Classify", icon: "M21 12a9 9 0 1 1-3-6.7M21 3v6h-6" },
  { label: "Merge Gate", icon: "M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 9v6m0 6a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm12-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 0a9 9 0 0 1-9 9" },
  { label: "Verified", icon: "M20 6 9 17l-5-5" },
];

export function ClosedLoop() {
  return (
    <div className="relative mx-auto max-w-6xl">
      <div className="hidden items-center md:flex">
        {steps.map((s, i) => (
          <div key={s.label} className="flex flex-1 items-center">
            <div className="flex flex-col items-center text-center">
              <div
                className={`grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br shadow-lg ${
                  i === steps.length - 1
                    ? "from-emerald-500 to-emerald-400 shadow-emerald-500/30"
                    : "from-indigo-500 via-violet-500 to-emerald-400 shadow-indigo-500/20"
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d={s.icon} />
                </svg>
              </div>
              <span className="mt-3 w-24 text-sm font-medium text-slate-200">{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className="mx-1 h-0.5 flex-1 rounded bg-gradient-to-r from-indigo-500/60 to-emerald-400/60" />
            )}
          </div>
        ))}
      </div>

      {/* mobile vertical */}
      <div className="space-y-3 md:hidden">
        {steps.map((s, i) => (
          <div key={s.label} className="flex items-center gap-3">
            <div className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ${i === steps.length - 1 ? "from-emerald-500 to-emerald-400" : "from-indigo-500 via-violet-500 to-emerald-400"}`}>
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d={s.icon} />
              </svg>
            </div>
            <span className="text-sm font-medium text-slate-200">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
