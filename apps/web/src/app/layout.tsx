import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { Providers } from "@/components/Providers";
import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import localFont from "next/font/local";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PHONE_FIELDS_16 } from "@/lib/dashboard-phone";
import { BRAND, OG_IMAGE, SITE_URL } from "@/lib/seo";
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

// No `alternates` here: a root canonical would be inherited by every page that
// sets none (login, apply, unsubscribe...) and point them all at the homepage.
export const metadata: Metadata = {
  title: { default: "CnC Realty | California Real Estate Brokerage", template: "%s | CnC Realty" },
  description:
    "California real estate brokerage. Search homes for sale and rent, connect with local agents, and join CnC Realty.",
  metadataBase: new URL(SITE_URL),
  openGraph: { siteName: BRAND, type: "website", images: [OG_IMAGE] },
  twitter: { card: "summary_large_image" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en" className={`${googleSansFlex.variable} ${inter.variable} ${cormorant.variable} dark`}>
      {/* Phones: every text box at 16px so iPhone Safari doesn't auto-zoom on
          tap (the zoom then carried over to the next page). Desktop unchanged. */}
      <body className={`antialiased ${PHONE_FIELDS_16}`}>
        <Providers session={session}>
          <Navbar />
          <main className="relative z-10">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
