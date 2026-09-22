import type { Metadata } from "next";
import { Figtree, Fraunces } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { MobileCTABar } from "@/components/molecules/mobile-cta-bar";
import { MotionProvider } from "@/components/motion-provider";
import { BRAND_NAME } from "@/lib/brand";

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  axes: ["SOFT", "opsz"],
  variable: "--font-fraunces",
});

const figtree = Figtree({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-figtree",
});

const TITLE = `${BRAND_NAME} - Le tuteur qui ne donne pas la réponse`;
const DESCRIPTION =
  "Assistant scolaire pour collégiens, de la 6e à la 3e. Tom guide votre enfant par des questions, à la manière d'un bon professeur, et vous tient informé sans lire ses conversations.";

export const metadata: Metadata = {
  title: {
    default: TITLE,
    template: `%s | ${BRAND_NAME}`,
  },
  description: DESCRIPTION,
  applicationName: BRAND_NAME,
  category: "education",
  keywords: [
    BRAND_NAME, "tutorat", "éducation", "IA",
    "aide aux devoirs", "aide devoirs IA",
    "soutien scolaire", "soutien scolaire IA",
    "tuteur IA français", "méthode socratique IA",
    "collège", "6e", "5e", "4e", "3e",
    "application éducative", "app scolaire",
    "IA européenne", "Mistral",
  ],
  authors: [{ name: BRAND_NAME }],
  creator: BRAND_NAME,
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    title: TITLE,
    description: DESCRIPTION,
    siteName: BRAND_NAME,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  metadataBase: new URL("https://tomia.fr"),
  alternates: {
    canonical: "/",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: BRAND_NAME,
    applicationCategory: "EducationApplication",
    operatingSystem: "Web",
    inLanguage: "fr",
    description: DESCRIPTION,
    offers: [
      {
        "@type": "Offer",
        price: "0",
        priceCurrency: "EUR",
        name: "Gratuit",
      },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND_NAME,
    url: "https://tomia.fr",
    logo: "https://tomia.fr/logo.svg",
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    url: "https://tomia.fr",
    name: BRAND_NAME,
    inLanguage: "fr",
  },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${fraunces.variable} ${figtree.variable}`}>
      <body>
        {jsonLd.map((schema, i) => (
          <script
            key={i}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
          />
        ))}
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-full">
          Aller au contenu principal
        </a>
        <MotionProvider>
          <div className="relative flex min-h-screen flex-col">
            <div aria-hidden="true" className="bg-notebook pointer-events-none fixed inset-0 -z-50" />
            <div aria-hidden="true" className="pointer-events-none fixed inset-y-0 left-4 -z-40 hidden w-px bg-annotation/40 md:block" />
            <Header />
            <main id="main-content" className="flex-1">
              {children}
            </main>
            <Footer />
            <MobileCTABar />
          </div>
        </MotionProvider>
      </body>
    </html>
  );
}
