import React from 'react';

export const CollapseIcon: React.FC<{ width?: number; height?: number }> = ({ width = 12, height = 20 }) => (
  <svg
    width={width}
    height={height ? height : (width / 12) * 20}
    viewBox="0 0 12 8"
    version="1.1"
    xmlnsXlink="http://www.w3.org/1999/xlink"
  >
    <g stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
      <g transform="translate(-18, -16)">
        <g transform="translate(24, 20) scale(-1, 1) rotate(90) translate(-24, -20) translate(12, 8)">
          <polygon fill="#000000" fillRule="nonzero" points="16.59 8.59 12 13.17 7.41 8.59 6 10 12 16 18 10" />
          <polygon transform="translate(12, 12) rotate(90) translate(-12, -12) " points="0 0 24 0 24 24 0 24" />
        </g>
        <g id="open" opacity="0" transform="translate(24, 20) scale(-1, 1) translate(-24, -20) translate(12, 8)">
          <polygon fill="#000000" fillRule="nonzero" points="16.59 8.59 12 13.17 7.41 8.59 6 10 12 16 18 10" />
          <polygon transform="translate(12, 12) rotate(90) translate(-12, -12) " points="0 0 24 0 24 24 0 24" />
        </g>
      </g>
    </g>
  </svg>
);

