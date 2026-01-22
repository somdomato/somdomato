import { AudioProvider } from "@/context/AudioContext";
import { Nunito } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import type { Metadata } from "next";
import "./globals.css";

const nunito = Nunito({ subsets: ["latin"], preload: false });

export const metadata: Metadata = {
  title: "Rádio Som do Mato",
  description: "A mais sertaneja",
  openGraph: {
    title: "Rádio Som do Mato",
    description: "A mais sertaneja",
    images: [
      {
        url: "https://somdomato.com/images/ogp.png",
        width: 256,
        height: 256,
        alt: "Rádio Som do Mato",
      },
    ],
    siteName: "Rádio Som do Mato",
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
        <link
          rel="icon"
          href="/images/logotipo.svg"
          sizes="any"
          type="image/svg+xml"
        />
      </head>
      <body className={nunito.className}>
        <AudioProvider>
          <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 flex items-center justify-center min-h-0 w-full px-2 md:px-4">
              {children}
            </main>
            <Footer />
          </div>
        </AudioProvider>
      </body>
    </html>
  );
}
