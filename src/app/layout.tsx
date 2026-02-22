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
  title: "TrafficFlow v31.0 Enterprise - Traffic Management SaaS",
  description: "Enterprise-grade traffic management with comprehensive User Agent & Browser Fingerprint configuration. 100% organic detection with market-share weighted UA rotation, WebGL/Canvas/Audio anti-fingerprinting, and complete browser simulation.",
  keywords: ["TrafficFlow", "Traffic Management", "Analytics", "GA4", "Campaigns", "SaaS", "SEO", "Marketing", "IP Rotation", "ISP Simulation", "CTR Optimization", "SERP Engagement", "Safety Score", "Anomaly Detection", "Algorithm Response", "Audit Trail", "Compliance", "Integrations", "Google Ads", "Facebook Ads", "Bing Webmaster", "User Agent Rotation", "Browser Fingerprint", "Anti-Detection", "Organic Traffic"],
  authors: [{ name: "TrafficFlow Team" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "TrafficFlow v31.0 Enterprise",
    description: "Enterprise-grade traffic management with User Agent & Browser Fingerprint configuration for 100% organic detection",
    url: "https://trafficflow.io",
    siteName: "TrafficFlow",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TrafficFlow v31.0 Enterprise",
    description: "Enterprise-grade traffic management with User Agent & Browser Fingerprint configuration for 100% organic detection",
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
