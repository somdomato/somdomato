import { Nunito } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";

const nunito = Nunito({ subsets: ["latin"], preload: false });

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
      <body className={nunito.className}>
        <div className="flex flex-col min-h-screen">
          <header className="sticky z-50 bg-gray-300 top-0 p-4">
            Rádio Som do Mato
          </header>
          <main className="flex-grow">
            {children}
          </main>
          <footer className="sticky z-50 bg-gray-300 bottom-0 p-4">
            &copy; 2011-{new Date().getFullYear()} Rádio Som do Mato
          </footer>
        </div>
      </body>
    </html>
  );
}
