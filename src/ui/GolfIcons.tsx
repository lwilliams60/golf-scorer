const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

/** Ball on a tee: fairways. */
export const TeeIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="6.5" r="3.5" />
    <path d="M8.5 10.5h7l-2.5 3v6.5h-2V13.5z" />
  </svg>
)

/** Flag on the green: greens in regulation. */
export const FlagIcon = () => (
  <svg {...base}>
    <path d="M9 19V3l8 3.5L9 10" />
    <ellipse cx="11" cy="19.5" rx="7" ry="2" />
  </svg>
)

/** Chip onto the green: scrambling. */
export const ChipIcon = () => (
  <svg {...base}>
    <path d="M3 19c3-1.5 6-1.5 9 0s6 1.5 9 0" />
    <path d="M5 15c2-7 9-10 14-6" strokeDasharray="2 2.5" />
    <circle cx="19" cy="9" r="1.8" fill="currentColor" />
  </svg>
)

/** Ball rolling to the hole: putts. */
export const PuttIcon = () => (
  <svg {...base}>
    <ellipse cx="16" cy="17" rx="4" ry="1.6" />
    <circle cx="6" cy="16" r="2" />
    <path d="M8.5 16h4" strokeDasharray="1.5 2" />
    <path d="M16 17V5l4 1.8L16 8.5" />
  </svg>
)

/** Scorecard and pencil: scoring. */
export const CardIcon = () => (
  <svg {...base}>
    <rect x="4" y="3" width="13" height="18" rx="2" />
    <path d="M7.5 8h6M7.5 12h6M7.5 16h3" />
    <path d="M20 7l-5 9-1.5 1 .3-1.8 5-9z" />
  </svg>
)
