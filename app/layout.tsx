import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host?.includes("localhost") ? "http" : "https");
  const origin = host ? `${protocol}://${host}` : "http://localhost:3000";
  const socialImage = `${origin}/og.png`;

  return {
    title: "JourneySync — Every plan. Every person. One journey.",
    description:
      "A calm, collaborative home for itineraries, travel documents, group expenses, and real-time trip updates.",
    manifest: "/manifest.webmanifest",
    applicationName: "JourneySync",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
      apple: "/favicon.svg",
    },
    other: {
      "theme-color": "#0c79d8",
      "mobile-web-app-capable": "yes",
      "apple-mobile-web-app-capable": "yes",
      "apple-mobile-web-app-status-bar-style": "default",
    },
    openGraph: {
      title: "JourneySync",
      description: "Every plan. Every person. One journey.",
      images: [
        {
          url: socialImage,
          width: 1680,
          height: 941,
          alt: "JourneySync Swiss Escape trip planner",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "JourneySync",
      description: "Every plan. Every person. One journey.",
      images: [socialImage],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
