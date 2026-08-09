"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    __yamaInstallPrompt?: Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
  }
}

export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      window.__yamaInstallPrompt = event as Window["__yamaInstallPrompt"];
      window.dispatchEvent(new Event("yama:pwa-install-ready"));
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  return null;
}
