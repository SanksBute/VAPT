import React from 'react';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps): JSX.Element {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('text-primary', className)}
      aria-label="SentinelX AI"
    >
      <rect width="32" height="32" rx="8" fill="currentColor" fillOpacity="0.15" />
      <path
        d="M16 4L6 8.5V16.5C6 21.75 10.4 26.7 16 28C21.6 26.7 26 21.75 26 16.5V8.5L16 4Z"
        fill="currentColor"
        fillOpacity="0.3"
      />
      <path
        d="M16 6.5L8 10.5V17.5C8 21.75 11.6 25.7 16 27C20.4 25.7 24 21.75 24 17.5V10.5L16 6.5Z"
        fill="currentColor"
      />
      <path
        d="M13 15.5L15.5 18L19.5 13"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
