import Header from "@/components/Header";
import { AudioProvider } from "@/context/AudioContext";
import { Nunito } from "next/font/google";
import { Toaster } from "sonner";
import type { Metadata } from "next";
import "./globals.css";
import { Guitar } from "lucide-react";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: "Rádio Som do Mato",
  description: "A mais sertaneja",
  openGraph: {
    title: "Rádio Som do Mato",
    description: "A mais sertaneja",
    url: "https://somdomato.com",
    siteName: "Rádio Som do Mato",
    images: [
      {
        url: "https://somdomato.com/images/ogp.png",
        width: 256,
        height: 256,
        alt: "Rádio Som do Mato",
      },
    ],
    locale: "pt_BR",
    type: "website",
  },
};

export default function RootLayout({
  children,
  requests,
}: Readonly<{
  children: React.ReactNode;
  requests: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="icon"
          href="/images/logotipo.svg"
          type="image/svg+xml"
          sizes="any"
        />
      </head>
      <body className={`${nunito.variable} antialiased`}>
        <AudioProvider>
          <div className="flex flex-col min-h-screen">
            <Header />
            <div className="grow">
              <main className="container mx-auto">{children}</main>
            </div>
            <footer className="sticky z-50 bg-background bottom-0 border-t-2 border-t-black/50 shadow-sm">
              <div className="container mx-auto text-center py-4 text-sm text-gray-400 italic">
                Copyright © 2012-{new Date().getFullYear()} Rádio Som do Mato
                <br />
                Por amor a música sertaneja{" "}
                <Guitar className="inline" size={20} />
              </div>
            </footer>
          </div>
          {requests}
          <Toaster />
        </AudioProvider>
      </body>
    </html>
  );
}
