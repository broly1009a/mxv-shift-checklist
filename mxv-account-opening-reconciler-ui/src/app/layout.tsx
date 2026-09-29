import type { Metadata } from "next";
import { AuthProvider } from "@/context/AuthContext";
import { TutorialProvider } from "@/context/TutorialContext";
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
  title: "Đối Soát Mở TKGD | MXV Standalone",
  description: "Phân hệ độc lập Đối soát & Thẩm định Hồ sơ Mở Tài khoản Giao dịch - Sở Giao Dịch Hàng Hóa Việt Nam (MXV)",
  icons: {
    icon: "/logomxv.png",
    shortcut: "/logomxv.png",
    apple: "/logomxv.png",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={cn("font-sans", plusJakartaSans.variable)} data-theme="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-[#090e1a] text-slate-100 antialiased selection:bg-emerald-500 selection:text-white">
        <AuthProvider>
          <TutorialProvider>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#16213e',
                  color: '#f8fafc',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  fontSize: '13px',
                },
              }}
            />
          </TutorialProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
