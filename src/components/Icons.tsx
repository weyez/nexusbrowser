import type { ReactNode, SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const icon = (children: ReactNode) =>
  function Icon(props: P) {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
        {children}
      </svg>
    );
  };

export const IconBack = icon(<path d="M15 18l-6-6 6-6" />);
export const IconForward = icon(<path d="M9 18l6-6-6-6" />);
export const IconReload = icon(<><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></>);
export const IconClose = icon(<path d="M18 6 6 18M6 6l12 12" />);
export const IconHome = icon(<><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></>);
export const IconPlus = icon(<path d="M12 5v14M5 12h14" />);
export const IconStar = icon(<path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z" />);
export const IconLock = icon(<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>);
export const IconSearch = icon(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>);
export const IconGlobe = icon(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>);
export const IconExpand = icon(<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />);
export const IconShrink = icon(<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />);
export const IconSliders = icon(<><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>);
export const IconExternal = icon(<><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>);
export const IconShield = icon(<><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" /><path d="M9.5 9.5l5 5M14.5 9.5l-5 5" /></>);
export const IconOffline = icon(<><path d="M5 12.6a10 10 0 0 1 3.3-2M19 12.6a10 10 0 0 0-4.7-2.4M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8A15 15 0 0 0 10 5.3" /><path d="M8.5 16.4a5 5 0 0 1 7 0M12 20h.01M3 3l18 18" /></>);
export const IconEyeOff = icon(<><path d="M3 3l18 18" /><path d="M10.6 5.1A10 10 0 0 1 12 5c5 0 9 4.5 10 7a13 13 0 0 1-3 4.2M6.6 6.6C4.3 8 2.7 10.2 2 12c1 2.5 5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>);
export const IconTrash = icon(<><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13M9 7V4h6v3" /></>);
export const IconWarning = icon(<><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17h.01" /></>);
