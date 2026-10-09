import type { ReactNode } from "react";
import { hostnameOf } from "../lib/url";
import { IconBack, IconExternal, IconOffline, IconReload, IconShield, IconWarning } from "./Icons";

export function openExternally(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}

function Shell({ icon, title, children, actions }: { icon: ReactNode; title: string; children: ReactNode; actions: ReactNode }) {
  return (
    <div className="absolute inset-0 grid place-items-center overflow-auto bg-bg p-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-elev text-accent">{icon}</div>
        <h2 className="mb-2 text-lg font-semibold">{title}</h2>
        <div className="mb-6 text-sm leading-relaxed text-muted">{children}</div>
        <div className="flex flex-wrap justify-center gap-2">{actions}</div>
      </div>
    </div>
  );
}

export function ActionButton({ onClick, children, primary }: { onClick(): void; children: ReactNode; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium pointer-coarse:h-12 ${primary ? "bg-accent text-white hover:brightness-110" : "bg-elev hover:bg-line"}`}
    >
      {children}
    </button>
  );
}

const REASONS: Record<string, string> = {
  "x-frame-options": "This site sends an X-Frame-Options header telling browsers not to show it inside other pages.",
  "csp-frame-ancestors": "This site's Content-Security-Policy (frame-ancestors) only lets specific sites embed it.",
};

export function BlockedPage({ url, reason, canGoBack, onBack, onTryAnyway }: { url: string; reason: string; canGoBack: boolean; onBack(): void; onTryAnyway(): void }) {
  return (
    <Shell
      icon={<IconShield width={28} height={28} />}
      title={`${hostnameOf(url)} can't be shown inside NEXUS`}
      actions={
        <>
          <ActionButton primary onClick={() => openExternally(url)}>
            <IconExternal width={16} height={16} /> Open in a normal tab
          </ActionButton>
          {canGoBack && (
            <ActionButton onClick={onBack}>
              <IconBack width={16} height={16} /> Go back
            </ActionButton>
          )}
          <ActionButton onClick={onTryAnyway}>Try anyway</ActionButton>
        </>
      }
    >
      <p>{REASONS[reason] ?? "This site refuses to be displayed inside another page."}</p>
      <p className="mt-2">This is the site's security choice and NEXUS respects it. You can still open it as a regular browser tab.</p>
    </Shell>
  );
}

export type ErrorKind = "offline" | "mixed-content" | "self" | "stopped";

export function ErrorPage({ kind, url, onRetry }: { kind: ErrorKind; url: string; onRetry(): void }) {
  const content: Record<ErrorKind, { title: string; text: string; icon: ReactNode }> = {
    offline: { title: "You're offline", text: "Check your internet connection. NEXUS will retry automatically when you're back online.", icon: <IconOffline width={28} height={28} /> },
    "mixed-content": {
      title: "Insecure page blocked",
      text: "NEXUS runs over HTTPS, and browsers block insecure http:// pages inside secure ones. Try the https:// version or open it in a normal tab.",
      icon: <IconWarning width={28} height={28} />,
    },
    self: { title: "Can't open NEXUS inside itself", text: "Opening this app inside its own tab is disabled to prevent loops.", icon: <IconWarning width={28} height={28} /> },
    stopped: { title: "Loading stopped", text: hostnameOf(url), icon: <IconWarning width={28} height={28} /> },
  };
  const c = content[kind];
  return (
    <Shell
      icon={c.icon}
      title={c.title}
      actions={
        <>
          {kind !== "self" && (
            <ActionButton primary onClick={onRetry}>
              <IconReload width={16} height={16} /> Try again
            </ActionButton>
          )}
          {kind === "mixed-content" && (
            <>
              <ActionButton onClick={() => openExternally(url)}>
                <IconExternal width={16} height={16} /> Open in a normal tab
              </ActionButton>
            </>
          )}
        </>
      }
    >
      {c.text}
    </Shell>
  );
}
