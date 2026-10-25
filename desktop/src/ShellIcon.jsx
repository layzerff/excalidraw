import React from 'react';
import { THEMES, themeId } from './themes.mjs';
export function ThemePaletteIcon() {
  return (
    <svg
      data-ui-icon="theme-palette"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="M12 2.5c-5.3 0-9.5 3.8-9.5 8.6 0 3.1 2.2 4.1 5.2 4.1h2c1.4 0 2.2.8 2.2 2.1v1.1c0 2 1.1 3.1 3 3.1 4 0 6.6-4.5 6.6-9.6C21.5 6.3 17.3 2.5 12 2.5Z"
        fill="#ffffff"
        stroke="#24292f"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle
        cx="6.6"
        cy="10.1"
        r="1.7"
        fill="#ff3b30"
        stroke="#24292f"
        strokeWidth="1.2"
      />
      <circle
        cx="11.1"
        cy="6.9"
        r="1.7"
        fill="#ffd60a"
        stroke="#24292f"
        strokeWidth="1.2"
      />
      <circle
        cx="16.7"
        cy="8.8"
        r="1.7"
        fill="#00b8d9"
        stroke="#24292f"
        strokeWidth="1.2"
      />
      <circle
        cx="15.5"
        cy="17.5"
        r="1.7"
        fill="#ffffff"
        stroke="#24292f"
        strokeWidth="1.2"
      />
    </svg>
  );
}
export function ShellIcon({ name, theme = 'github', open = false, size = 18 }) {
  const id = themeId(theme),
    stroke = THEMES[id].stroke;
  const paths = {
    home:
      id === 'notion'
        ? 'M4 11 12 4l8 7v9h-6v-6h-4v6H4v-9Z'
        : id === 'reddit'
          ? 'm4 10 8-6 8 6v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9Z'
          : 'm3 10 9-7 9 7v11h-6v-7H9v7H3V10Z',
    folder:
      id === 'vscode'
        ? 'M3 6h6l2 2h10v12H3V6Z'
        : open
          ? 'M3 7V5h7l2 2h9v3H6L3 20V7Zm0 13 3-10h17l-3 10H3Z'
          : 'M3 20V5h7l2 2h9v13H3Z',
    document:
      id === 'notion'
        ? 'M5 3h14v18H5V3Zm4 5h6m-6 4h6m-6 4h4'
        : 'M5 3h9l5 5v13H5V3Zm9 0v5h5M8 12h8m-8 4h8',
    chevron:
      id === 'notion'
        ? open
          ? 'm6 9 6 7 6-7H6Z'
          : 'm9 5 7 7-7 7V5Z'
        : open
          ? 'm6 9 6 6 6-6'
          : 'm9 6 6 6-6 6',
    palette:
      id === 'vscode'
        ? 'M4 4h16v16H4V4Zm0 5h16M9 9v11'
        : id === 'reddit'
          ? 'M5 12a7 7 0 1 1 10 6c-2 1-1-3-3-3H8a3 3 0 0 1-3-3Zm3-3h.01M12 6h.01m4 4h.01'
          : 'M4 4h16v16H4V4Zm4 4h3v3H8V8Zm5 5h3v3h-3v-3Z',
  };
  return (
    <svg
      className={name === 'folder' ? 'folder-icon' : undefined}
      data-ui-icon={name}
      data-icon-theme={id}
      width={name === 'chevron' ? 16 : size}
      height={name === 'chevron' ? 16 : size}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d={paths[name]}
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap={id === 'vscode' ? 'square' : 'round'}
        strokeLinejoin={id === 'reddit' ? 'round' : 'miter'}
        fill={name === 'chevron' && id === 'notion' ? 'currentColor' : 'none'}
      />
    </svg>
  );
}
