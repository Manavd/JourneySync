"use client";

import { useEffect } from "react";
import { JOURNEYSYNC_BUILD_ID } from "./release-version";

const RELEASE_CHECK_INTERVAL_MS = 60_000;

export default function ReleaseRefresh() {
  useEffect(() => {
    let reloading = false;

    const checkForUpdate = async () => {
      if (reloading) return;
      try {
        const response = await fetch(`/api/version?time=${Date.now()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        if (!response.ok) return;
        const data = await response.json() as { version?: string };
        if (data.version && data.version !== JOURNEYSYNC_BUILD_ID) {
          reloading = true;
          window.location.reload();
        }
      } catch {
        // Staying on the current release is safer than interrupting an offline traveler.
      }
    };

    const checkWhenVisible = () => {
      if (document.visibilityState === "visible") void checkForUpdate();
    };
    const interval = window.setInterval(() => void checkForUpdate(), RELEASE_CHECK_INTERVAL_MS);
    window.addEventListener("focus", checkWhenVisible);
    document.addEventListener("visibilitychange", checkWhenVisible);
    void checkForUpdate();

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", checkWhenVisible);
      document.removeEventListener("visibilitychange", checkWhenVisible);
    };
  }, []);

  return null;
}
