import { type ReactNode, useState, useEffect } from "react";

interface AnimateHeightProps {
  open: boolean;
  children: ReactNode;
  duration?: number;
}

export default function AnimateHeight({ open, children, duration = 250 }: AnimateHeightProps) {
  const [hasOpened, setHasOpened] = useState(open);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => setHasOpened(true), duration);
      return () => clearTimeout(timer);
    } else {
      setHasOpened(false);
    }
  }, [open, duration]);

  return (
    <div
      className={`grid ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      style={{ transition: `grid-template-rows ${duration}ms ease-out` }}
    >
      <div className={open && hasOpened ? "overflow-visible" : "overflow-hidden"}>{children}</div>
    </div>
  );
}
