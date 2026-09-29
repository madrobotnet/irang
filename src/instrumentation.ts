export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.DATABASE_URL?.trim()) {
    const { retryAttachmentCleanup } = await import("@/server/notes/attachment-cleanup");
    // Replay durable work without coupling server readiness to storage health.
    void retryAttachmentCleanup();
  }
}
