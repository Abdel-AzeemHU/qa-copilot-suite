export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startSchedulerLoop } = await import("./lib/scheduler-loop");
    startSchedulerLoop();
  }
}
