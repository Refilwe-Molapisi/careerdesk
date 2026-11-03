"use client";

import { useSyncExternalStore } from "react";

/**
 * Tiny store for the browser install prompt, shared between the PWA
 * registration component (which captures the event) and the Settings card
 * (which renders the install button).
 */

type InstallState = {
  canInstall: boolean;
  installed: boolean;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let promptEvent: BeforeInstallPromptEvent | null = null;
let standalone = false;
let initialised = false;

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function refreshStandalone() {
  if (typeof window === "undefined") return;
  standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true;
}

function init() {
  if (initialised || typeof window === "undefined") return;
  initialised = true;
  refreshStandalone();
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", () => {
    refreshStandalone();
    emit();
  });
}

/** Called by PwaRegistration when beforeinstallprompt fires. */
export function captureInstallPrompt(event: Event) {
  init();
  event.preventDefault();
  promptEvent = event as BeforeInstallPromptEvent;
  emit();
}

/** Called by PwaRegistration when appinstalled fires. */
export function markInstalled() {
  init();
  promptEvent = null;
  standalone = true;
  emit();
}

/** Returns the pending event (or null) for the Settings card to prompt with. */
export function getPromptEvent(): BeforeInstallPromptEvent | null {
  return promptEvent;
}

function subscribe(listener: () => void) {
  init();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): InstallState {
  return { canInstall: promptEvent !== null, installed: standalone };
}

function getServerSnapshot(): InstallState {
  return { canInstall: false, installed: false };
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
