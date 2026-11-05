"use client";

import { useSyncExternalStore } from "react";

/**
 * Tiny store for the browser install prompt, shared between the PWA
 * registration component (which captures the event) and the Settings card
 * (which renders the install button).
 *
 * useSyncExternalStore requires getSnapshot to return the SAME object until
 * the state actually changes; returning a fresh object every call makes
 * React re-render forever ("Maximum update depth exceeded"). So the state
 * lives in one module-level object that is only replaced when a value
 * really changes.
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

/** Single cached snapshot: stable between emits, safe for useSyncExternalStore. */
let state: InstallState = { canInstall: false, installed: false };
const serverState: InstallState = { canInstall: false, installed: false };

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function recompute() {
  const next = {
    canInstall: promptEvent !== null,
    installed: standalone,
  };
  if (next.canInstall !== state.canInstall || next.installed !== state.installed) {
    state = next;
    emit();
  }
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
  recompute();
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", () => {
    refreshStandalone();
    recompute();
  });
}

/** Called by PwaRegistration when beforeinstallprompt fires. */
export function captureInstallPrompt(event: Event) {
  init();
  event.preventDefault();
  promptEvent = event as BeforeInstallPromptEvent;
  recompute();
}

/** Called by PwaRegistration when appinstalled fires. */
export function markInstalled() {
  init();
  promptEvent = null;
  standalone = true;
  recompute();
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
  return state;
}

function getServerSnapshot(): InstallState {
  return serverState;
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
