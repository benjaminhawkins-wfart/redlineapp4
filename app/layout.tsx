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
      <head>
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; form-action 'none'"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
