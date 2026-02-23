import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { BackgroundPattern } from "@/components/atoms/background-pattern";
import { MobileCTABar } from "@/components/molecules/mobile-cta-bar";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: {
    default: "TomIA - L'IA qui aide votre enfant à comprendre ses leçons",
    template: "%s | TomIA",
  },
  description: "TomIA est un assistant IA pour les élèves du CP à la Terminale. Il guide votre enfant avec la méthode socratique, sans donner les réponses. Aligné sur les programmes Éduscol.",
  applicationName: "TomIA",
  category: "education",
  keywords: [
    "TomIA", "tutorat", "éducation", "IA",
    "aide aux devoirs", "aide devoirs IA",
    "soutien scolaire", "soutien scolaire IA",
    "tuteur IA français", "méthode socratique IA",
    "collège", "lycée", "CP", "Terminale",
    "application éducative", "app scolaire",
  ],
  authors: [{ name: "TomIA" }],
  creator: "TomIA",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    title: "TomIA - L'IA qui aide votre enfant à comprendre ses leçons",
    description: "Assistant IA pour élèves du CP à la Terminale. Méthode socratique, programmes Éduscol, sans donner les réponses.",
    siteName: "TomIA",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "TomIA - L'IA qui aide votre enfant à comprendre ses leçons",
    description: "Assistant IA pour élèves du CP à la Terminale. Méthode socratique, programmes Éduscol, sans donner les réponses.",
  },
  metadataBase: new URL("https://tomia.fr"),
  alternates: {
    canonical: "/",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
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
    name: "TomIA",
    applicationCategory: "EducationApplication",
    operatingSystem: "iOS, Android",
    inLanguage: "fr",
    description: "Assistant IA de tutorat pour élèves du CP à la Terminale. Méthode socratique, programmes Éduscol.",
    offers: [
      {
        "@type": "Offer",
        price: "0",
        priceCurrency: "EUR",
        name: "Gratuit",
      },
      {
        "@type": "Offer",
        price: "15",
        priceCurrency: "EUR",
        name: "Complet",
      },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "TomIA",
    url: "https://tomia.fr",
    logo: "https://tomia.fr/logo.png",
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    url: "https://tomia.fr",
    name: "TomIA",
    inLanguage: "fr",
  },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${inter.variable} ${jakarta.variable}`}>
        {jsonLd.map((schema, i) => (
          <script
            key={i}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
          />
        ))}
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md">
          Aller au contenu principal
        </a>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="flex min-h-screen flex-col relative">
            <BackgroundPattern />
            <Header />
            <main id="main-content" className="flex-1">
              {children}
            </main>
            <Footer />
            <MobileCTABar />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
