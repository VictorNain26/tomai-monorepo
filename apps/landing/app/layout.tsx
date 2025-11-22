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
    default: "TomIA - Assistant Pédagogique Socratique Adaptatif",
    template: "%s | TomIA",
  },
  description: "Plateforme de tutorat intelligent pour étudiants français (CP à Terminale). Méthode socratique adaptative basée sur l'IA pour un apprentissage personnalisé.",
  keywords: ["tutorat", "éducation", "IA", "apprentissage", "socratique", "adaptatif", "français", "collège", "lycée"],
  authors: [{ name: "TomIA" }],
  creator: "TomIA",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    title: "TomIA - Assistant Pédagogique Socratique",
    description: "Révolutionnez l'apprentissage avec l'IA socratique adaptative",
    siteName: "TomIA",
  },
  twitter: {
    card: "summary_large_image",
    title: "TomIA - Assistant Pédagogique Socratique",
    description: "Révolutionnez l'apprentissage avec l'IA socratique adaptative",
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
