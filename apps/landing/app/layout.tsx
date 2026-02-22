import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { BackgroundPattern } from "@/components/atoms/background-pattern";

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
    default: "Tom - L'IA qui aide votre enfant à comprendre ses leçons",
    template: "%s | Tom",
  },
  description: "Tom est un assistant IA pour les élèves du CP à la Terminale. Il guide votre enfant avec la méthode socratique, sans donner les réponses. Aligné sur les programmes Éduscol.",
  keywords: ["tutorat", "éducation", "IA", "aide aux devoirs", "soutien scolaire", "méthode socratique", "collège", "lycée", "CP", "Terminale"],
  authors: [{ name: "Tom" }],
  creator: "Tom",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    title: "Tom - L'IA qui aide votre enfant à comprendre ses leçons",
    description: "Assistant IA pour élèves du CP à la Terminale. Méthode socratique, programmes Éduscol, sans donner les réponses.",
    siteName: "Tom",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tom - L'IA qui aide votre enfant à comprendre ses leçons",
    description: "Assistant IA pour élèves du CP à la Terminale. Méthode socratique, programmes Éduscol, sans donner les réponses.",
  },
  metadataBase: new URL('https://tomai.fr'),
  alternates: {
    canonical: '/',
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${inter.variable} ${jakarta.variable}`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="flex min-h-screen flex-col relative">
            <BackgroundPattern />
            <Header />
            <main className="flex-1">
              {children}
            </main>
            <Footer />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
