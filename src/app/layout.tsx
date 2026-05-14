import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'yorgos.ai',
  description: 'Ο AI βοηθός σου για πελάτες, follow-ups και προσφορές.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="el" className={`${geist.variable} h-full`}>
      <body className="h-full bg-zinc-50 text-zinc-900 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
