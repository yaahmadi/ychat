"use client";

import { useEffect } from "react";

const PWA_CACHE_VERSION = "ychat-v1.0.7";

declare global {
  interface Window {
    __yamaInstallPrompt?: Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
  }
}

export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").then((registration) => {
        void registration.update();
        const clearedVersion = window.localStorage.getItem("ychat:pwa-cache-version");
        if (navigator.serviceWorker.controller && clearedVersion !== PWA_CACHE_VERSION) {
          navigator.serviceWorker.controller.postMessage({ type: "YCHAT_CLEAR_CACHE" });
          window.localStorage.setItem("ychat:pwa-cache-version", PWA_CACHE_VERSION);
        }
      });
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
