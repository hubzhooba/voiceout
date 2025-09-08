import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CreatorTent - Invoice Management Platform",
  description: "Private two-party invoice management tents for seamless collaboration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} relative min-h-screen`} suppressHydrationWarning>
        {/* Optimized gradient mesh background */}
        <div className="fixed inset-0 bg-mesh -z-10" />
        
        {/* Static gradient overlay for performance */}
        <div className="fixed inset-0 overflow-hidden -z-10 pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200/10 rounded-full" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-200/10 rounded-full" />
        </div>
        
        {/* Main content */}
        <div className="relative z-0">
          {children}
        </div>
        
        <Toaster />
      </body>
    </html>
  );
}