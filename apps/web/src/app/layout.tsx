import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Beff — Production intelligence for battery cell manufacturing',
    template: '%s | Beff',
  },
  description:
    'See where yield is lost, what it costs in scrap, and what it means for CO₂ per kWh.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // `lang` becomes dynamic when the [locale] segment lands (ENG-34). Screen
    // readers pick pronunciation from this, so it must never be wrong.
    <html lang="en">
      <body>
        {/* Skip link — first focusable element on the page, per WCAG 2.4.1. */}
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <div id="main">{children}</div>
      </body>
    </html>
  );
}
