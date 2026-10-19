"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * Media query used by every GSAP effect so hover-only and reduced-motion
 * preferences are honoured consistently.
 */
export const MOTION_CONDITIONS = {
  /** Pointer devices that support hover and have not asked for reduced motion. */
  hoverMotion: "(hover: hover) and (prefers-reduced-motion: no-preference)",
  /** Any device that has not asked for reduced motion. */
  motionOk: "(prefers-reduced-motion: no-preference)",
};

let registered = false;

/**
 * Return the shared GSAP instance with plugins registered exactly once.
 * Safe to call during render on the client; returns `null` on the server.
 *
 * @returns {typeof gsap | null} GSAP instance, or null when `window` is unavailable.
 */
export function getGsap() {
  if (typeof window === "undefined") return null;
  if (!registered) {
    gsap.registerPlugin(ScrollTrigger);
    registered = true;
  }
  return gsap;
}
