import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Test Site",
  description: "An isolated surface for testing product integrations.",
};

export default function TestSiteLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return <div className="min-h-screen bg-white text-black">{children}</div>;
}
