"use client";

import { useEffect } from "react";

export default function AutoPrintOnLoad({ enabled = false }) {
  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => {
      window.print();
    }, 250);
    return () => clearTimeout(timer);
  }, [enabled]);

  return null;
}
