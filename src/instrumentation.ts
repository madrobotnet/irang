export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.DATABASE_URL?.trim()) {
    const { runNoteMaintenance } = await import("@/server/notes/trash");
    // Replay durable work and trash retention without coupling server readiness to storage health.
    void runNoteMaintenance();
  }
}
