"use client";

import { useEffect } from "react";

/**
 * Registers the service worker in production builds and captures the
 * browser install prompt so Settings can offer "Install Career Desk".
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    __careerDeskInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

export const INSTALL_PROMPT_EVENT = "careerdesk:install-available";

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

    const captureInstallPrompt = (event: Event) => {
      event.preventDefault();
      window.__careerDeskInstallPrompt = event as BeforeInstallPromptEvent;
      window.dispatchEvent(new Event(INSTALL_PROMPT_EVENT));
    };
    window.addEventListener("beforeinstallprompt", captureInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
      window.removeEventListener("load", register);
    };
  }, []);

  return null;
}
