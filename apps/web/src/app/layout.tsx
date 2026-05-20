import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { Providers } from "@/components/Providers";
import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import localFont from "next/font/local";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import "./globals.css";

const googleSansFlex = localFont({
  src: "./fonts/GoogleSansFlex.woff2",
  variable: "--font-sans",
  display: "swap",
  weight: "100 900",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-chopin",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "CnC Realty Group", template: "%s | CnC Realty Group" },
  description:
    "California real estate brokerage. Search MLS listings, connect with agents, and grow your business.",
  metadataBase: new URL("https://cncrealtygroup.com"),
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en" className={`${googleSansFlex.variable} ${inter.variable} ${cormorant.variable} dark`}>
      <body className="antialiased">
        <Providers session={session}>
          <Navbar />
          <main className="relative z-10">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
