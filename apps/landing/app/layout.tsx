import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "TomAI - Assistant Pédagogique Socratique Adaptatif",
    template: "%s | TomAI",
  },
  description: "Plateforme de tutorat intelligent pour étudiants français (CP à Terminale). Méthode socratique adaptative basée sur l'IA pour un apprentissage personnalisé.",
  keywords: ["tutorat", "éducation", "IA", "apprentissage", "socratique", "adaptatif", "français", "collège", "lycée"],
  authors: [{ name: "TomAI" }],
  creator: "TomAI",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    title: "TomAI - Assistant Pédagogique Socratique",
    description: "Révolutionnez l'apprentissage avec l'IA socratique adaptative",
    siteName: "TomAI",
  },
  twitter: {
    card: "summary_large_image",
    title: "TomAI - Assistant Pédagogique Socratique",
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
      <body className={inter.variable}>
        {children}
      </body>
    </html>
  );
}
