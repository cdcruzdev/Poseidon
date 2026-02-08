import type { ReactNode } from "react";

interface AnimateHeightProps {
  open: boolean;
  children: ReactNode;
  duration?: number;
}

export default function AnimateHeight({ open, children, duration = 250 }: AnimateHeightProps) {
  return (
    <div
      className={`grid ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      style={{ transition: `grid-template-rows ${duration}ms ease-out` }}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}
