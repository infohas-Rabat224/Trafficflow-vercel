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
  title: "TrafficFlow v25.0 Enterprise - Traffic Management SaaS",
  description: "Enterprise-grade traffic management and analytics platform with Phase 6 PAA Integration. People Also Asked question discovery, PAA click simulation, answer box engagement, and question-based traffic routing.",
  keywords: ["TrafficFlow", "Traffic Management", "Analytics", "GA4", "Campaigns", "SaaS", "SEO", "Marketing", "IP Rotation", "ISP Simulation", "CTR Optimization", "SERP Engagement", "PAA", "People Also Asked", "Featured Snippets", "Question-Based Routing"],
  authors: [{ name: "TrafficFlow Team" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "TrafficFlow v25.0 Enterprise",
    description: "Enterprise-grade traffic management with PAA Integration and Question-Based Traffic Routing",
    url: "https://trafficflow.io",
    siteName: "TrafficFlow",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TrafficFlow v25.0 Enterprise",
    description: "Enterprise-grade traffic management with PAA Integration and Question-Based Traffic Routing",
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
