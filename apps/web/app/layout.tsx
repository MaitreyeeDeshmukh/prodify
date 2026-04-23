import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import SessionProviderWrapper from '@/components/session-provider';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });

export const metadata: Metadata = {
  title: 'Prodify',
  description: 'One command. Production-ready SaaS infrastructure.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.variable}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
      </body>
    </html>
  );
}
