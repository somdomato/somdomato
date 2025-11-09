import Header from "@/components/Header";
import { AudioProvider } from "@/context/AudioContext";
import { Nunito } from "next/font/google";
import { Toaster } from 'sonner'
import type { Metadata } from "next";
import "./globals.css";

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
              <main className="container mx-auto">
                {children}
              </main>
            </div>
            <footer className="sticky z-50 bg-background bottom-0">
              <div className="container mx-auto text-center">
                Copyright © 2012-{new Date().getFullYear()} Rádio Som do Mato
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
