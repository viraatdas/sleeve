import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Private share",
  description: "A time-limited private record shared through Sleeve.",
  robots: { index: false, follow: false, noarchive: true, noimageindex: true },
  referrer: "no-referrer",
};

export default function ShareLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
