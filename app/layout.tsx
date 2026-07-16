import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Redline — Compare documents clearly",
  description: "Compare pasted text or Word documents and copy a clean Markdown redline.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
