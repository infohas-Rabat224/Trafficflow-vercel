import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TrafficFlow v32.0 Enterprise - Traffic Management SaaS",
  description: "Enterprise-grade traffic management with Behavior Pattern Simulation. Scroll depth variations, click simulation, time on page control, bounce rate management, pages per session, and return visitor simulation for 100% organic traffic patterns.",
  keywords: ["TrafficFlow", "Traffic Management", "Analytics", "GA4", "Campaigns", "SaaS", "SEO", "Marketing", "User Agent Rotation", "Browser Fingerprint", "Anti-Detection", "Organic Traffic", "Behavior Simulation", "Scroll Depth", "Click Simulation", "Bounce Rate", "Pages Per Session", "Return Visitors"],
  authors: [{ name: "TrafficFlow Team" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "TrafficFlow v32.0 Enterprise",
    description: "Enterprise-grade traffic management with Behavior Pattern Simulation for 100% organic traffic patterns",
    url: "https://trafficflow.io",
    siteName: "TrafficFlow",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TrafficFlow v32.0 Enterprise",
    description: "Enterprise-grade traffic management with Behavior Pattern Simulation for 100% organic traffic patterns",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
