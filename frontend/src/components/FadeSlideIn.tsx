import type { ReactNode } from "react";

interface FadeSlideInProps {
  show: boolean;
  children: ReactNode;
  duration?: number;
}

export default function FadeSlideIn({ show, children, duration = 250 }: FadeSlideInProps) {
  return (
    <div
      className={`transition-all ${show ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 pointer-events-none"}`}
      style={{ transitionDuration: `${duration}ms`, transitionTimingFunction: "ease-out" }}
    >
      {children}
    </div>
  );
}
