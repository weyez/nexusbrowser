type WebkitDocument = Document & { webkitFullscreenElement?: Element | null; webkitFullscreenEnabled?: boolean; webkitExitFullscreen?: () => void };
type WebkitElement = HTMLElement & { webkitRequestFullscreen?: () => void };

export function fullscreenSupported(): boolean {
  const d = document as WebkitDocument;
  const el = document.documentElement as WebkitElement;
  return !!(el.requestFullscreen || el.webkitRequestFullscreen) && !!(d.fullscreenEnabled ?? d.webkitFullscreenEnabled);
}

export function isFullscreen(): boolean {
  const d = document as WebkitDocument;
  return !!(d.fullscreenElement || d.webkitFullscreenElement);
}

export async function enterFullscreen(): Promise<void> {
  const el = document.documentElement as WebkitElement;
  if (el.requestFullscreen) await el.requestFullscreen();
  else el.webkitRequestFullscreen?.();
}

export async function exitFullscreen(): Promise<void> {
  const d = document as WebkitDocument;
  if (d.exitFullscreen) await d.exitFullscreen();
  else d.webkitExitFullscreen?.();
}

export function onFullscreenChange(cb: () => void): () => void {
  document.addEventListener("fullscreenchange", cb);
  document.addEventListener("webkitfullscreenchange", cb);
  return () => {
    document.removeEventListener("fullscreenchange", cb);
    document.removeEventListener("webkitfullscreenchange", cb);
  };
}
