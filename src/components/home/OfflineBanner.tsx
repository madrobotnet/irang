"use client";

import { useEffect, useState } from "react";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { offlineBannerMessage } from "./home-model";

export function OfflineBanner() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      setMessage(offlineBannerMessage(window.navigator.onLine));
    };
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!message) return null;
  return <ErrorBanner message={message} />;
}
