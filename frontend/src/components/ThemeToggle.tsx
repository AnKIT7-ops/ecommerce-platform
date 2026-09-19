import { useTheme } from "../hooks/useTheme";

/**
 * Light/dark switch, styled as a two-position instrument selector rather than
 * a lone icon: both states stay visible, with the active one carried on the
 * volt accent, so the control reads the way the rest of the store does.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={isDark}
      aria-label={isDark ? "Switch to the light theme" : "Switch to the dark theme"}
      title={isDark ? "Switch to the light theme" : "Switch to the dark theme"}
      className={`group relative flex h-9 items-center gap-0.5 rounded-[6px] border border-hairline bg-shell p-0.5 transition-colors hover:border-ink/30 ${className}`}
    >
      {/* The travelling volt block. Sliding it rather than restyling each half
          keeps one moving part, which reads as a physical switch. */}
      <span
        aria-hidden
        className={`absolute top-0.5 bottom-0.5 left-0.5 w-8 rounded-[4px] bg-volt transition-transform duration-300 ease-[cubic-bezier(0.22,0.68,0.26,1)] ${
          isDark ? "translate-x-8" : "translate-x-0"
        }`}
      />

      <Face active={!isDark} label="Light">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
      </Face>

      <Face active={isDark} label="Dark">
        <path d="M20 14.5A8.2 8.2 0 0 1 9.5 4a8.3 8.3 0 1 0 10.5 10.5z" />
      </Face>
    </button>
  );
}

function Face({
  active,
  label,
  children,
}: {
  active: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`relative flex h-8 w-8 items-center justify-center rounded-[4px] transition-colors ${
        active ? "text-panel-ink" : "text-muted group-hover:text-ink"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-[18px] w-[18px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}
