import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { QueryProvider } from '@/components/providers/query-provider';
import { AuthProvider } from '@/components/providers/auth-provider';
import { WebSocketProvider } from '@/components/providers/websocket-provider';
import { Toaster } from '@/components/ui/toaster';
import '@/styles/globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://app.sentinelx.io'),
  title: {
    default: 'SentinelX AI — Enterprise Security Platform',
    template: '%s | SentinelX AI',
  },
  description:
    'Enterprise AI-powered offensive security platform. Vulnerability management, penetration testing orchestration, compliance, and AI-driven threat intelligence.',
  keywords: [
    'vulnerability management',
    'penetration testing',
    'security platform',
    'VAPT',
    'cybersecurity',
    'AI security',
    'compliance',
    'DAST',
    'SAST',
    'threat intelligence',
  ],
  authors: [{ name: 'SentinelX Team' }],
  creator: 'SentinelX AI',
  robots: {
    index: false, // Enterprise product — no indexing
    follow: false,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'SentinelX AI',
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <QueryProvider>
            <AuthProvider>
              <WebSocketProvider>
                {children}
                <Toaster />
              </WebSocketProvider>
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
