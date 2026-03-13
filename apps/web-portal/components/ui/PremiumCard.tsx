import React from 'react';

export type AccentColor = 'blue' | 'green' | 'yellow' | 'purple' | 'red' | 'orange';

const ACCENT_MAP: Record<AccentColor, string> = {
  blue:   'border-t-4 border-t-blue-500',
  green:  'border-t-4 border-t-green-500',
  yellow: 'border-t-4 border-t-yellow-500',
  purple: 'border-t-4 border-t-purple-500',
  red:    'border-t-4 border-t-red-500',
  orange: 'border-t-4 border-t-orange-500',
};

export function PremiumCard({
  children,
  className = 'p-8',
  accentColor,
}: {
  children: React.ReactNode;
  className?: string;
  accentColor?: AccentColor;
}) {
  const accent = accentColor ? ACCENT_MAP[accentColor] : '';
  return (
    <div className={`bg-white rounded-2xl shadow-xl shadow-slate-200/50 ${accent} ${className}`.trim()}>
      {children}
    </div>
  );
}
