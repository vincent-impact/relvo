import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NavVisibilityProvider } from "@/components/layout/nav-visibility";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Relvo",
  description: "Assistant IA de pilotage des sollicitations professionnelles.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>
          <NavVisibilityProvider>{children}</NavVisibilityProvider>
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
