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
  title: "TrafficFlow v30.0 Enterprise - Traffic Management SaaS",
  description: "Enterprise-grade traffic management and analytics platform with Content Center improvements. Domain-specific AI suggestions, content gap analysis, and performance metrics. Enhanced data accuracy and real-time analytics.",
  keywords: ["TrafficFlow", "Traffic Management", "Analytics", "GA4", "Campaigns", "SaaS", "SEO", "Marketing", "IP Rotation", "ISP Simulation", "CTR Optimization", "SERP Engagement", "Safety Score", "Anomaly Detection", "Algorithm Response", "Audit Trail", "Compliance", "Integrations", "Google Ads", "Facebook Ads", "Bing Webmaster"],
  authors: [{ name: "TrafficFlow Team" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "TrafficFlow v30.0 Enterprise",
    description: "Enterprise-grade traffic management with full integrations hub - GA4, GSC, Google Ads, Facebook Ads, Bing Webmaster",
    url: "https://trafficflow.io",
    siteName: "TrafficFlow",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TrafficFlow v30.0 Enterprise",
    description: "Enterprise-grade traffic management with full integrations hub - GA4, GSC, Google Ads, Facebook Ads, Bing Webmaster",
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
