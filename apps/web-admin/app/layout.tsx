import './globals.css';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { Navbar } from '../components/Navbar';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.className} bg-slate-50 text-slate-800 antialiased pointer-events-auto`}
        suppressHydrationWarning
      >
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <main className="flex-1 bg-slate-50">
            <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
