/**
 * Iconos de la aplicación como trazos SVG (24×24, estilo lineal).
 * Cada cadena puede contener varios subtrazos que empiezan por "M".
 */
export const ICONS = {
  select: 'M5 3.5 11.5 20l2.3-6.2 6.2-2.3Z',
  editText: 'M4 7V5h11v2 M9.5 5v14 M7 19h5 M18 9v11 M16 9h4 M16 20h4',
  text: 'M5 7V5h14v2 M12 5v14 M9 19h6',
  highlight: 'm9 11-6 6v3h9l3-3 M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4',
  pen: 'M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5Z M15 5l4 4',
  rect: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z',
  ellipse: 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z',
  line: 'M5 19 19 5',
  arrow: 'M5 19 19 5 M10 5h9v9',
  shapes:
    'M8.3 10a.7.7 0 0 1-.6-1.1l3.7-6a.7.7 0 0 1 1.2 0l3.7 6a.7.7 0 0 1-.6 1.1z M14 14h7v7h-7z M7 13.5a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 1 0 0-7.5z',
  whiteout:
    'M20 20H7l-4-4a1 1 0 0 1 0-1.4l10-10a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1 0 1.4L11 20 M6 11l7 7',
  image:
    'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M9 8a1.5 1.5 0 1 0 0 3 1.5 1.5 0 1 0 0-3z M21 15l-5-5L5 21',
  signature: 'M3 16c3-3.5 4.5-10 6.5-10S9 15 11 15s2.5-3.5 4-3.5 1 3 2.5 3 2-1 3.5-1 M3 20h18',
  note: 'M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5z M15 3v5a1 1 0 0 0 1 1h5 M7 13h7 M7 17h4',
  stamp:
    'M5 22h14 M19.3 14H4.7A1.7 1.7 0 0 0 3 15.7V18h18v-2.3a1.7 1.7 0 0 0-1.7-1.7z M14 14V9.5a3.5 3.5 0 1 0-4 0V14',
  check: 'M20 6 9 17l-5-5',
  cross: 'M18 6 6 18 M6 6l12 12',
  dot: 'M12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6z',
  close: 'M18 6 6 18 M6 6l12 12',
  undo: 'M9 14 4 9l5-5 M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  redo: 'm15 14 5-5-5-5 M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
  zoomIn: 'M11 4a7 7 0 1 0 0 14 7 7 0 1 0 0-14z M21 21l-4.3-4.3 M8 11h6 M11 8v6',
  zoomOut: 'M11 4a7 7 0 1 0 0 14 7 7 0 1 0 0-14z M21 21l-4.3-4.3 M8 11h6',
  fitPage: 'M3 12h18 M7 8l-4 4 4 4 M17 8l4 4-4 4',
  download: 'M12 3v12 M7 10l5 5 5-5 M5 21h14',
  folder:
    'M4 20h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-7.9a1 1 0 0 1-.8-.4L9.5 4.4A1 1 0 0 0 8.7 4H4a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1z',
  filePlus: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z M14 3v6h6 M12 12v6 M9 15h6',
  file: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z M14 3v6h6',
  files:
    'M15 2H8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z M15 2v5h5 M3 7v13a2 2 0 0 0 2 2h10',
  rotateCw: 'M21 12a9 9 0 1 1-3-6.7L21 8 M21 3v5h-5',
  rotateCcw: 'M3 12a9 9 0 1 0 3-6.7L3 8 M3 3v5h5',
  trash: 'M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6 M10 11v6 M14 11v6',
  copy: 'M9 9h11v11H9z M5 15H4V4h11v1',
  split:
    'M6 3a3 3 0 1 0 0 6 3 3 0 1 0 0-6z M6 15a3 3 0 1 0 0 6 3 3 0 1 0 0-6z M20 4 8.1 15.9 M14.5 14.5 20 20 M8.1 8.1 12 12',
  extract: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6 M14 3v6h6v4 M16 17h6 M19 14l3 3-3 3',
  watermark: 'M12 2.7 17.7 8.3a8 8 0 1 1-11.4 0z',
  hash: 'M4 9h16 M4 15h16 M10 3 8 21 M16 3l-2 18',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z M12 16v-4 M12 8h.01',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 1 0 0-14z M21 21l-4.3-4.3',
  pages:
    'M8 4h11a1 1 0 0 1 1 1v13 M5 7h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 1 0 0-8z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4',
  printer:
    'M6 9V3h12v6 M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2 M6 14h12v7H6z',
  chevronUp: 'm18 15-6-6-6 6',
  chevronDown: 'm6 9 6 6 6-6',
  bold: 'M6 4h7a4 4 0 0 1 0 8H6z M6 12h8a4 4 0 0 1 0 8H6z',
  italic: 'M19 4h-9 M14 20H5 M15 4 9 20',
  underline: 'M6 4v6a6 6 0 0 0 12 0V4 M4 21h16',
  alignLeft: 'M3 6h18 M3 12h12 M3 18h15',
  alignCenter: 'M3 6h18 M6 12h12 M4.5 18h15',
  alignRight: 'M3 6h18 M9 12h12 M6 18h15',
  front: 'M9 9h11v11H9z M4 15V4h11',
  back: 'M4 4h11v11H4z M9 20h11V9',
  plus: 'M12 5v14 M5 12h14',
  minus: 'M5 12h14',
  reverse: 'M7 3v18 M3 7l4-4 4 4 M17 21V3 M13 17l4 4 4-4',
  sidebar: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M9 3v18',
  panel: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M15 3v18',
  lock: 'M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z M8 11V7a4 4 0 0 1 8 0v4',
  keyboard:
    'M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z M6 10h.01 M10 10h.01 M14 10h.01 M18 10h.01 M7 14h10',
  grid: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z',
  sortAsc: 'M3 16l4 4 4-4 M7 20V4 M14 4h6l-6 7h6 M14 20l3-6.5 3 6.5 M15 18h4',
  sortDesc: 'M3 16l4 4 4-4 M7 20V4 M14 13h6l-6 7h6 M14 11l3-6.5 3 6.5 M15 9h4',
  toStart: 'M5 4v16 M19 12H9 M13 8l-4 4 4 4',
  toEnd: 'M19 4v16 M5 12h10 M11 8l4 4-4 4',
  arrowLeft: 'M19 12H5 M11 6l-6 6 6 6',
  arrowRight: 'M5 12h14 M13 6l6 6-6 6',
  grip: 'M9 6h.01 M15 6h.01 M9 12h.01 M15 12h.01 M9 18h.01 M15 18h.01',
} as const;

export type IconName = keyof typeof ICONS;
