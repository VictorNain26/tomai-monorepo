import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@repo/ui";
import { PageLayout } from "@/components/layout/page-layout";

export const metadata: Metadata = {
  title: "Page introuvable",
};

export default function NotFound() {
  return (
    <PageLayout title="Page introuvable" description="Cette page n'existe pas ou plus.">
      <Button asChild size="lg">
        <Link href="/">Retour à l&apos;accueil</Link>
      </Button>
    </PageLayout>
  );
}
