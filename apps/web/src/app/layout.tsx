import type { Metadata } from 'next';
import { Sora, DM_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { LicenseProvider } from '@/lib/license-context';
import { Toaster } from '@/components/ui/toaster';
import { DynamicFavicon } from '@/components/dynamic-favicon';

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'VPN Platform',
  description: 'SaaS VPN Management Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}>
      <body className="font-body antialiased">
        <DynamicFavicon />
        <AuthProvider>
          <LicenseProvider>
            {children}
            <Toaster />
          </LicenseProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
