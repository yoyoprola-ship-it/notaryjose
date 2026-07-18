import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Notary Jose — Bilingual Notary Public in Lafayette, LA',
  description:
    'Jose E. Garcia — Notary Public serving Lafayette, LA in English and Spanish. Powers of attorney, USCIS/NVC forms, contracts, taxes, and more.',
  openGraph: {
    title: 'Notary Jose · Lafayette, LA',
    description:
      'Bilingual notary services — powers of attorney, USCIS forms, contracts, taxes.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-stone-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
