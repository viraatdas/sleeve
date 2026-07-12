import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Sleeve", template: "%s · Sleeve" },
  description: "A highly secure home for life's essential records.",
  applicationName: "Sleeve",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Sleeve",
    description: "One private place for life's essential records — easy to find, renew, and share on your terms.",
    siteName: "Sleeve",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sleeve",
    description: "One private place for life's essential records — easy to find, renew, and share on your terms.",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
