import React from 'react';
import {colors, fontFamily} from '../theme';

// The site's `.hero-start-button` / `.primary-button`: a terracotta pill with
// a soft colored shadow and an arrow that nudges right on hover.
export const PillButton: React.FC<{
  children: React.ReactNode;
  fontSize?: number;
  arrow?: boolean;
  arrowNudge?: number;
  lift?: number;
  style?: React.CSSProperties;
}> = ({children, fontSize = 30, arrow = true, arrowNudge = 0, lift = 0, style}) => {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: colors.primaryDark,
        color: colors.primaryForeground,
        borderRadius: 999,
        padding: `${fontSize * 0.62}px ${fontSize * 1.55}px`,
        fontFamily,
        fontSize,
        fontWeight: 750,
        letterSpacing: '-0.01em',
        boxShadow: `0 ${14 + lift * 6}px ${34 + lift * 10}px rgba(145, 75, 55, ${
          0.2 + lift * 0.06
        })`,
        transform: `translateY(${-lift * 2}px)`,
        ...style,
      }}
    >
      {children}
      {arrow ? (
        <svg
          width={fontSize * 1.05}
          height={fontSize * 1.05}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            marginLeft: fontSize * 0.55,
            opacity: 0.72,
            transform: `translateX(${arrowNudge}px)`,
          }}
        >
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
      ) : null}
    </div>
  );
};
