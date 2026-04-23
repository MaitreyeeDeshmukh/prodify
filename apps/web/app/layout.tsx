import type { Metadata } from 'next';
import { Unbounded, Public_Sans } from 'next/font/google';
import SessionProviderWrapper from '@/components/session-provider';
import './globals.css';

const unbounded = Unbounded({
  subsets: ['latin'],
  variable: '--font-unbounded',
  weight: ['400', '600', '700', '900'],
});

const publicSans = Public_Sans({
  subsets: ['latin'],
  variable: '--font-public-sans',
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'Prodify',
  description: 'One command. Production-ready SaaS infrastructure.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${unbounded.variable} ${publicSans.variable}`}>
      <body className="min-h-screen bg-background text-foreground font-sans">
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
      </body>
    </html>
  );
}
