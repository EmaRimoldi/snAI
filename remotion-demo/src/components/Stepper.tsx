import React from 'react';
import {colors, fontFamily} from '../theme';

const LockIcon: React.FC<{size?: number}> = ({size = 15}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    strokeLinecap="round"
  >
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);

const CheckIcon: React.FC<{size?: number}> = ({size = 15}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={3}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export type StepState = 'active' | 'locked' | 'done';

// Replica of the app's pill stepper (`pipeline-module__stepper`).
export const Stepper: React.FC<{
  states: [StepState, StepState, StepState];
  width?: number;
}> = ({states, width}) => {
  const labels = ['Profile', 'Understand', 'Prepare'];
  return (
    <div style={{display: 'flex', gap: 14, width}}>
      {labels.map((label, i) => {
        const state = states[i];
        const active = state === 'active';
        const done = state === 'done';
        return (
          <div
            key={label}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '13px 20px',
              borderRadius: 999,
              border: `1.5px solid ${active ? colors.primary : colors.input}`,
              background: active ? 'rgba(232, 223, 207, 0.45)' : 'transparent',
              color:
                active || done ? colors.foreground : colors.mutedForeground,
              opacity: state === 'locked' ? 0.55 : 1,
              fontFamily,
              fontWeight: 700,
              fontSize: 22,
            }}
          >
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: active ? colors.primary : colors.secondary,
                color: active ? colors.primaryForeground : colors.primaryDark,
                fontSize: 18,
                fontWeight: 800,
                flex: 'none',
              }}
            >
              {state === 'locked' ? (
                <LockIcon />
              ) : done ? (
                <CheckIcon />
              ) : (
                i + 1
              )}
            </span>
            {label}
          </div>
        );
      })}
    </div>
  );
};
