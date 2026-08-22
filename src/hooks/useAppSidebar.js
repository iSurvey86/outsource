"use client";

import { useCallback, useEffect, useState } from "react";

const PIN_KEY = "outsrc_sidebar_pinned";
const LG_MIN = 1024;

function readPinned() {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(PIN_KEY) !== "0";
  } catch {
    return true;
  }
}

/** Sidebar: mobile = drawer auto-hide; desktop = ghim / thu gọn icon (kiểu ksnpsc). */
export function useAppSidebar() {
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pinned, setPinnedState] = useState(true);

  useEffect(() => {
    setPinnedState(readPinned());
    const mq = window.matchMedia(`(max-width: ${LG_MIN - 1}px)`);
    const apply = () => {
      const mobile = mq.matches;
      setIsMobile(mobile);
      if (!mobile) setMobileOpen(false);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const togglePin = useCallback(() => {
    setPinnedState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(PIN_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const collapsed = !isMobile && !pinned;

  return {
    isMobile,
    mobileOpen,
    pinned,
    collapsed,
    togglePin,
    openMobile,
    closeMobile,
  };
}
