"use client";

import { useEffect } from "react";
import {
  captureInstallPrompt,
  markInstalled,
} from "@/components/pwa/install-prompt-store";

/**
 * Registers the service worker in production builds and captures the
 * browser install prompt into the shared install-prompt store so Settings
 * can offer "Install Career Desk".
 */
export function PwaRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("Service worker registration failed:", err);
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    window.addEventListener("appinstalled", markInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
      window.removeEventListener("appinstalled", markInstalled);
      window.removeEventListener("load", register);
    };
  }, []);

  return null;
}
