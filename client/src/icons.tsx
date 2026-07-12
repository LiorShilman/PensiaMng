/**
 * ספריית האייקונים של המערכת — SVG קווי אחיד (בהשראת Lucide, MIT).
 * stroke: currentColor — יורש את צבע הטקסט; .t-icon צובע בסגול המערכת.
 * הוחלפו האימוג'ים: ב-Windows הם מרונדרים כקו-מתאר חיוור ובלתי-נראה על רקע כהה.
 */

import type { SVGProps } from 'react';

const base: SVGProps<SVGSVGElement> = {
  width: 17,
  height: 17,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  className: 't-icon',
};

/** קיבוע זכויות — לוח עם וי */
export const IconClipboard = (
  <svg {...base}>
    <rect x="8" y="2" width="8" height="4" rx="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="m9 14 2 2 4-4" />
  </svg>
);

/** הטבות מס — מטבעות */
export const IconCoins = (
  <svg {...base}>
    <circle cx="8" cy="8" r="6" />
    <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
    <path d="M7 6h1v4" />
    <path d="m16.71 13.88.7.71-2.82 2.82" />
  </svg>
);

/** פרישה מדומה — שעון חול */
export const IconHourglass = (
  <svg {...base}>
    <path d="M5 22h14" />
    <path d="M5 2h14" />
    <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
    <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
  </svg>
);

/** עזיבת עבודה — דלת פתוחה */
export const IconDoorOpen = (
  <svg {...base}>
    <path d="M13 4h3a2 2 0 0 1 2 2v14" />
    <path d="M2 20h3" />
    <path d="M13 20h9" />
    <path d="M10 12v.01" />
    <path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.562z" />
  </svg>
);

/** משיכה הדרגתית בפרישה — שקיעה */
export const IconSunset = (
  <svg {...base}>
    <path d="M12 10V2" />
    <path d="m4.93 10.93 1.41 1.41" />
    <path d="M2 18h2" />
    <path d="M20 18h2" />
    <path d="m19.07 10.93-1.41 1.41" />
    <path d="M22 22H2" />
    <path d="m16 6-4 4-4-4" />
    <path d="M16 18a4 4 0 0 0-8 0" />
  </svg>
);

/** ניתוח AI — ניצוץ */
export const IconSparkles = (
  <svg {...base}>
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="M5 3v4" />
    <path d="M19 17v4" />
    <path d="M3 5h4" />
    <path d="M17 19h4" />
  </svg>
);

/** יועץ צ'אט — בועת שיחה */
export const IconMessage = (
  <svg {...base}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

/** בוט AI (כפתור כותרת) */
export const IconBot = (
  <svg {...base} width={15} height={15}>
    <path d="M12 8V4H8" />
    <rect width="16" height="12" x="4" y="8" rx="2" />
    <path d="M2 14h2" />
    <path d="M20 14h2" />
    <path d="M15 13v2" />
    <path d="M9 13v2" />
  </svg>
);

/** כלי (צ'יפ שקיפות בצ'אט) */
export const IconWrench = (
  <svg {...base} width={12} height={12} className="t-icon chip-icon">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

/** מרכז ידע — ספר */
export const IconBook = (
  <svg {...base} width={15} height={15}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

/** קליטת דוח — מסמך */
export const IconDoc = (
  <svg {...base} width={14} height={14}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="13" y2="17" />
  </svg>
);

/** ייצוא לאקסל — גיליון */
export const IconSheet = (
  <svg {...base} width={14} height={14}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="3" y1="15" x2="21" y2="15" />
    <line x1="9" y1="3" x2="9" y2="21" />
    <line x1="15" y1="3" x2="15" y2="21" />
  </svg>
);

/** הפקת דוח — מדפסת */
export const IconPrinter = (
  <svg {...base} width={14} height={14}>
    <polyline points="6 9 6 2 18 2 18 9" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </svg>
);

/** אבטחה / 2FA — מגן */
export const IconShield = (
  <svg {...base} width={15} height={15}>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
  </svg>
);

/** כניסה נעולה (שלב קוד 2FA) — מנעול */
export const IconLock = (
  <svg {...base} width={16} height={16}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

/** סיור מודרך — מצפן */
export const IconCompass = (
  <svg {...base} width={15} height={15}>
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </svg>
);

/** סימולטור מסלול חיים — ציר עם אבני דרך */
export const IconMilestones = (
  <svg {...base} width={15} height={15}>
    <path d="M4 21V3" />
    <circle cx="4" cy="7" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="4" cy="13" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="4" cy="19" r="1.5" fill="currentColor" stroke="none" />
    <path d="M8 7h12" />
    <path d="M8 13h9" />
    <path d="M8 19h6" />
  </svg>
);

/** מסך משפחה — מבט זוגי, שני אנשים */
export const IconUsers = (
  <svg {...base} width={15} height={15}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
