import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { LicenseProvider } from '@/lib/license-context';
import { Toaster } from '@/components/ui/toaster';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'VPN Platform',
  description: 'SaaS VPN Management Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
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
