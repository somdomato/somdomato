import { AudioProvider } from "@/context/AudioContext";
import { GenreProvider } from "@/context/GenreContext";
import { LiveProvider } from "@/context/LiveContext";
import { Nunito } from "next/font/google";
import { Toaster } from "sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PageTracker from "@/components/PageTracker";
import BackToTop from "@/components/BackToTop";
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
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal?: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link
          rel="icon"
          href="/images/logotipo.svg"
          sizes="any"
          type="image/svg+xml"
        />
      </head>
      <body className={nunito.className}>
        <Toaster position="bottom-right" />
        <PageTracker />
        <GenreProvider>
          <AudioProvider>
            <LiveProvider>
              <div className="flex flex-col min-h-screen relative">
                <Header />
                <main className="flex-1">{children}</main>
                <Footer />
                <BackToTop />
                {modal}
              </div>
            </LiveProvider>
          </AudioProvider>
        </GenreProvider>
      </body>
    </html>
  );
}
