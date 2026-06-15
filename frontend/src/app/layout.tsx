import type { Metadata } from "next";
import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Shift Checklist Digitalization | MXV",
  description: "Hệ thống quản lý ca trực vận hành Sở Giao Dịch Hàng Hóa Việt Nam (MXV)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={cn("font-sans", geist.variable)}>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
