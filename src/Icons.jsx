// Inline SVG icons — no font loading required

const s = { display: "inline-block", verticalAlign: "middle", flexShrink: 0 };

const I = ({ d, size = 18, color = "currentColor" }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color} style={s}>
    <path d={d} />
  </svg>
);

export const IconAdd = (p) => <I {...p} d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />;
export const IconAutoAwesome = (p) => <I {...p} d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z" />;
export const IconFileOpen = (p) => <I {...p} d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />;
export const IconSave = (p) => <I {...p} d="M17 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z" />;
export const IconPlay = (p) => <I {...p} d="M8 5v14l11-7z" />;
export const IconPause = (p) => <I {...p} d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />;
export const IconStop = (p) => <I {...p} d="M6 6h12v12H6z" />;
export const IconSkipPrev = (p) => <I {...p} d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />;
export const IconSkipNext = (p) => <I {...p} d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />;
export const IconHelp = (p) => <I {...p} d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" />;
export const IconEqualizer = (p) => <I {...p} d="M10 20h4V4h-4v16zm-6 0h4v-8H4v8zM16 9v11h4V9h-4z" />;

// Export: cassette with down arrow
export const IconExport = ({ size = 18, color = "currentColor" }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={s}>
    <rect x="3" y="6" width="18" height="13" rx="2"/>
    <circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/>
    <path d="M7 12h10"/>
    <path d="M12 1v4m-2-1l2 1 2-1" fill="none"/>
  </svg>
);

// Tape/vinyl simulation toggle
export const IconTape = ({ size = 18, color = "currentColor" }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={s}>
    <rect x="2" y="5" width="20" height="14" rx="2"/>
    <circle cx="8.5" cy="12" r="2.5"/><circle cx="15.5" cy="12" r="2.5"/>
    <path d="M6 17h12"/>
  </svg>
);

// Clear current side
export const IconClearSide = (p) => <I {...p} d="M15 16h4v2h-4zm0-8h7v2h-7zm0 4h6v2h-6zM3 18c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2V8H3v10zM14 5h-3.5l-1-1h-5l-1 1H0v2h14V5z" />;
// Clear all
export const IconClearAll = (p) => <I {...p} d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />;
// Theme palette
export const IconPalette = (p) => <I {...p} d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-1.01 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />;
