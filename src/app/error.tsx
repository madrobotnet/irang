"use client";

import { StatusScreen } from "@/components/shell/StatusScreen";

/** Root error boundary for segments without a closer error.tsx. Next already logs the error. */
export default function RootError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <StatusScreen kind="error" onRetry={retry} digest={error.digest} />;
}
