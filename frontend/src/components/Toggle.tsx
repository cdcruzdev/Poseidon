"use client";

interface ToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}

export default function Toggle({ enabled, onChange, disabled = false }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0a1520] ${
        disabled
          ? "opacity-50 cursor-not-allowed"
          : ""
      } ${
        enabled
          ? "bg-[#7ec8e8] focus:ring-[#7ec8e8]"
          : "bg-[#2a4060] focus:ring-[#2a4060]"
      }`}
      role="switch"
      aria-checked={enabled}
    >
      <span className="sr-only">Toggle</span>
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full shadow ring-0 transition duration-200 ease-in-out ${
          enabled ? "translate-x-5 bg-[#0a1520]" : "translate-x-0 bg-[#7090a0]"
        }`}
      />
    </button>
  );
}
