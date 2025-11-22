import type { Metadata } from 'next';
import './globals.css';
import { AdminProvider } from '@/contexts/AdminContext';

export const metadata: Metadata = {
  title: 'ChronoCrypt KMS',
  description: 'Key Management System',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AdminProvider>
          {children}
        </AdminProvider>
      </body>
    </html>
  );
}
