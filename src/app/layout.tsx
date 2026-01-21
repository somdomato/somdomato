import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rádio Som do Mato",
  description: "A mais sertaneja",
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
