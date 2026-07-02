import type { Metadata } from "next";
import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";
import { Plus_Jakarta_Sans } from "next/font/google";
import { cn } from "@/lib/utils";
import { Toaster } from "react-hot-toast";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin', 'vietnamese'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-sans'
});

export const metadata: Metadata = {
  title: "Operate Checklist | MXV",
  description: "Hệ thống quản lý ca trực vận hành Sở Giao Dịch Hàng Hóa Việt Nam (MXV)",
  icons: {
    icon: "/logomxv.svg",
    shortcut: "/logomxv.svg",
    apple: "/logomxv.svg",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={cn("font-sans", plusJakartaSans.variable)} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  if (window.location.pathname === '/' || window.location.pathname.startsWith('/login')) {
                    document.documentElement.setAttribute('data-theme', 'dark');
                    return;
                  }
                  var storedTheme = localStorage.getItem('mxv_theme');
                  var storedUser = localStorage.getItem('mxv_user');
                  var userTheme;
                  if (storedUser) {
                    try {
                      var userObj = JSON.parse(storedUser);
                      if (userObj && userObj.settings && userObj.settings.theme) {
                        userTheme = userObj.settings.theme;
                      }
                    } catch (e) {}
                  }
                  var theme = userTheme || storedTheme || 'dark';
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) {}
              })();
            `
          }}
        />
      </head>
      <body>
        <AuthProvider>
          {children}
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'var(--bg-card, #16213e)',
                color: 'var(--text-primary, #ffffff)',
                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                borderRadius: '12px',
                fontFamily: 'inherit',
                fontSize: '0.9rem',
                backdropFilter: 'blur(8px)',
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#ffffff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#ffffff',
                },
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
