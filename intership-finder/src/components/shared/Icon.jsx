const paths = {
  logo: (
    <>
      <path d="M6.75 4.75h10.5a2 2 0 0 1 2 2v10.5a2 2 0 0 1-2 2H6.75a2 2 0 0 1-2-2V6.75a2 2 0 0 1 2-2Z" />
      <path d="M9 8.5h6" />
      <path d="M9 12h6" />
      <path d="M9 15.5h3.5" />
    </>
  ),
  tracker: (
    <>
      <rect x="4.5" y="5.5" width="15" height="13" rx="2" />
      <path d="M8 9h8" />
      <path d="M8 12.5h8" />
      <path d="M8 16h5" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="4.5" />
      <path d="m14 14 4 4" />
    </>
  ),
  analytics: (
    <>
      <path d="M5 18.5h14" />
      <path d="M8 16v-4.5" />
      <path d="M12 16V8" />
      <path d="M16 16v-6.5" />
    </>
  ),
  todo: (
    <>
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <path d="m8.5 11 2 2 5-5" />
    </>
  ),
  interview: (
    <>
      <path d="M7 7.5h10v6a5 5 0 0 1-10 0v-6Z" />
      <path d="M9.5 5.5v2" />
      <path d="M14.5 5.5v2" />
      <path d="M9 11h6" />
    </>
  ),
  offer: (
    <>
      <path d="M12 4.5 14.3 9l5 .7-3.6 3.5.9 5-4.6-2.4-4.6 2.4.9-5L4.7 9.7l5-.7L12 4.5Z" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.08-1l2.02-1.57-2-3.46-2.45.8a7.2 7.2 0 0 0-1.73-1L14.4 3h-4.8l-.36 2.77c-.62.25-1.2.58-1.73 1l-2.45-.8-2 3.46L5.08 11c-.05.33-.08.66-.08 1s.03.67.08 1l-2.02 1.57 2 3.46 2.45-.8c.53.42 1.11.75 1.73 1L9.6 21h4.8l.36-2.77c.62-.25 1.2-.58 1.73-1l2.45.8 2-3.46L18.92 13c.05-.33.08-.66.08-1Z" />
    </>
  ),
  login: (
    <>
      <path d="M10 6H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" />
      <path d="m13 8 4 4-4 4" />
      <path d="M9 12h8" />
    </>
  ),
  logout: (
    <>
      <path d="M14 6h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3" />
      <path d="m11 8-4 4 4 4" />
      <path d="M15 12H7" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  board: (
    <>
      <rect x="4.5" y="5.5" width="4.5" height="13" rx="1.5" />
      <rect x="9.75" y="8" width="4.5" height="10.5" rx="1.5" />
      <rect x="15" y="6.5" width="4.5" height="12" rx="1.5" />
    </>
  ),
  list: (
    <>
      <path d="M8.5 7.5h10" />
      <path d="M8.5 12h10" />
      <path d="M8.5 16.5h10" />
      <circle cx="5.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="5.5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="5.5" cy="16.5" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  timeline: (
    <>
      <path d="M6 6v12" />
      <path d="M6 9h4l2-2h6" />
      <path d="M6 15h5l2 2h5" />
      <circle cx="6" cy="6" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="6" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="6" cy="18" r="1.25" fill="currentColor" stroke="none" />
    </>
  ),
  empty: (
    <>
      <rect x="5" y="6" width="14" height="12" rx="2" />
      <path d="M8.5 10h7" />
      <path d="M8.5 13h4" />
    </>
  ),
  error: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="m9 9 6 6" />
      <path d="m15 9-6 6" />
    </>
  ),
  external: (
    <>
      <path d="M14 5h5v5" />
      <path d="m10 14 9-9" />
      <path d="M19 13v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" />
    </>
  ),
  spark: (
    <>
      <path d="M12 4.5 13.7 9l4.8 1.3-4.8 1.3-1.7 4.4-1.7-4.4-4.8-1.3L10.3 9 12 4.5Z" />
    </>
  ),
  close: (
    <>
      <path d="m7 7 10 10" />
      <path d="m17 7-10 10" />
    </>
  ),
};

export default function Icon({ name, className = "", size = 18, strokeWidth = 1.8 }) {
  const glyph = paths[name];
  if (!glyph) return null;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {glyph}
    </svg>
  );
}
