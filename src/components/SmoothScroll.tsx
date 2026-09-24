"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Eases wheel scrolling. On macOS a mouse wheel moves the page in ~100px
 * jumps with no animation; Lenis glides between them instead. Touch keeps the
 * device's own scrolling, panels with their own scroll (the sidebar, dialogs)
 * scroll normally, and reduced motion leaves everything native.
 *
 * It also marks <html data-scrolling> while anything scrolls, so the ambience
 * can pause its animations (see globals.css) and every frame goes to the page.
 */
export function SmoothScroll() {
  useEffect(() => {
    const root = document.documentElement;
    const lenis = matchMedia("(prefers-reduced-motion: reduce)").matches
      ? null
      : new Lenis({ autoRaf: true, lerp: 0.12, anchors: true, allowNestedScroll: true, stopInertiaOnNavigate: true });

    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      if (!("scrolling" in root.dataset)) root.dataset.scrolling = "";
      clearTimeout(timer);
      timer = setTimeout(() => delete root.dataset.scrolling, 180);
    };
    // Scroll events don't bubble; capturing catches the sidebar as well as the page.
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      clearTimeout(timer);
      lenis?.destroy();
    };
  }, []);
  return null;
}
