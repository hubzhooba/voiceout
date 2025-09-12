import type { Metadata } from "next";
import { Roboto, Space_Grotesk } from "next/font/google";
import "./globals.css";
import "./globals-hover.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { MuiProvider } from "@/components/providers/mui-theme-provider";
import { themeScript } from "@/lib/theme-script";
import { InstantLoadingProvider, progressBarStyles } from "@/components/providers/instant-loading-provider";

const roboto = Roboto({ 
  weight: ['300', '400', '500', '700'],
  subsets: ["latin"],
  display: 'swap',
  variable: '--font-roboto',
});

const spaceGrotesk = Space_Grotesk({
  weight: ['400', '500'],
  subsets: ["latin"],
  display: 'swap',
  variable: '--font-space-grotesk',
});

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
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <style dangerouslySetInnerHTML={{ __html: progressBarStyles }} />
      </head>
      <body className={`${roboto.variable} ${spaceGrotesk.variable} font-sans relative min-h-screen`} suppressHydrationWarning>
        <ThemeProvider>
          <MuiProvider>
            <InstantLoadingProvider>
            {/* Updated gradient mesh background with new color scheme */}
            <div className="fixed inset-0 bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-black dark:to-gray-900 -z-10" />
            
            {/* Subtle gradient overlays */}
            <div className="fixed inset-0 overflow-hidden -z-10 pointer-events-none">
              <div className="absolute -top-40 -right-40 w-80 h-80 bg-green-200/5 rounded-full" />
              <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-200/5 rounded-full" />
            </div>
            
            {/* Main content */}
            <div className="relative z-0">
              {children}
            </div>
            
            <Toaster />
            </InstantLoadingProvider>
          </MuiProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}