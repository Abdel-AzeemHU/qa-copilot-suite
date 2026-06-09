let started = false;

/**
 * Starts a polling loop that fires runDueSchedules every 60 seconds.
 * Safe to call multiple times — only starts once.
 */
export function startSchedulerLoop(): void {
  if (started) return;
  started = true;

  const tick = async () => {
    try {
      const { runDueSchedules } = await import("@/worker/scheduler");
      await runDueSchedules();
    } catch {
      // never crash the loop
    }
  };

  // Fire once then every 60s
  void tick();
  setInterval(() => void tick(), 60_000);
}
