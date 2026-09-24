"use client";

import { useEffect } from "react";

/**
 * Marks <html data-scrolling> while the page or a panel is scrolling, so the
 * ambience can pause its animations (see globals.css). The browser then only
 * has to move the page, not repaint glowing, blurred scenery on every frame.
 */
export function ScrollCalm() {
  useEffect(() => {
    const root = document.documentElement;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      root.dataset.scrolling = "";
      clearTimeout(timer);
      timer = setTimeout(() => delete root.dataset.scrolling, 180);
    };
    // Scroll events don't bubble; capturing catches the sidebar as well as the page.
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      clearTimeout(timer);
    };
  }, []);
  return null;
}
