import { forwardRef, memo } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { hostnameOf } from "../lib/url";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean; children: ReactNode };

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({ label, active, className = "", children, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={`grid size-9 shrink-0 place-items-center rounded-lg text-fg/80 transition-colors hover:bg-elev hover:text-fg active:bg-line disabled:pointer-events-none disabled:opacity-35 pointer-coarse:size-11 ${active ? "bg-elev text-accent" : ""} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});

const PALETTE = ["#7c5cff", "#2bb3a3", "#f0883e", "#e5484d", "#3e8ef7", "#c75fd6", "#46a758", "#d6a01f"];

export const SiteAvatar = memo(function SiteAvatar({ url, size = 18, label }: { url: string; size?: number; label?: string }) {
  const host = hostnameOf(url);
  const letter = (label?.trim()[0] ?? host[0] ?? "?").toUpperCase();
  let hash = 0;
  for (const ch of host) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-md font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.55, background: PALETTE[hash % PALETTE.length] }}
    >
      {letter}
    </span>
  );
});

export function Spinner({ size = 16 }: { size?: number }) {
  return <span aria-hidden="true" className="nx-spin inline-block shrink-0 rounded-full border-2 border-accent/30 border-t-accent" style={{ width: size, height: size }} />;
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-2">
      <span className="min-w-0">
        <span className="block text-sm">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" className="nx-switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
