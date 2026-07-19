import React from 'react';
import {colors, fontFamily, site} from '../theme';

// A minimal warm-toned browser chrome to frame the in-app walkthrough scenes.
export const BrowserFrame: React.FC<{
  width: number;
  height: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({width, height, children, style}) => {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 24,
        background: colors.background,
        border: `1.5px solid ${colors.input}`,
        boxShadow: '0 40px 90px rgba(42, 33, 28, 0.16)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '16px 22px',
          background: colors.muted,
          borderBottom: `1.5px solid ${colors.input}`,
        }}
      >
        <div style={{display: 'flex', gap: 9}}>
          {['#e0897457', '#d5c6b4', '#d5c6b4'].map((c, i) => (
            <div
              key={i}
              style={{
                width: 15,
                height: 15,
                borderRadius: '50%',
                background: i === 0 ? colors.primary : colors.input,
                opacity: i === 0 ? 0.8 : 0.7,
              }}
            />
          ))}
        </div>
        <div
          style={{
            flex: 1,
            maxWidth: 560,
            margin: '0 auto',
            background: colors.background,
            border: `1.5px solid ${colors.input}`,
            borderRadius: 999,
            padding: '8px 22px',
            fontFamily,
            fontSize: 20,
            fontWeight: 600,
            color: colors.mutedForeground,
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
          >
            <rect x="4" y="10" width="16" height="11" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
          {site.url}
        </div>
        <div style={{width: 63}} />
      </div>
      <div style={{flex: 1, position: 'relative'}}>{children}</div>
    </div>
  );
};
