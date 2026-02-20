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
  title: "TrafficFlow v24.0 Enterprise - Traffic Management SaaS",
  description: "Enterprise-grade traffic management and analytics platform with Phase 5 Analytics Footprint Safety. GA4 event timing randomization, session duration realism, return visitor simulation, and UTM parameter variation.",
  keywords: ["TrafficFlow", "Traffic Management", "Analytics", "GA4", "Campaigns", "SaaS", "SEO", "Marketing", "IP Rotation", "ISP Simulation", "CTR Optimization", "SERP Engagement", "Analytics Safety", "Event Timing"],
  authors: [{ name: "TrafficFlow Team" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "TrafficFlow v24.0 Enterprise",
    description: "Enterprise-grade traffic management with Analytics Footprint Safety and GA4 Event Timing Randomization",
    url: "https://trafficflow.io",
    siteName: "TrafficFlow",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TrafficFlow v24.0 Enterprise",
    description: "Enterprise-grade traffic management with Analytics Footprint Safety and GA4 Event Timing Randomization",
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
