import { FadeIn } from "@/components/atoms/fade-in";
import { SectionHeader } from "@/components/atoms/section-header";
import { NotebookSheet } from "@/components/notebook/notebook-sheet";

interface PageLayoutProps {
  title: string;
  description?: string;
  maxWidth?: "4xl" | "5xl";
  children: React.ReactNode;
}

export function PageLayout({ title, description, maxWidth = "4xl", children }: PageLayoutProps) {
  return (
    <NotebookSheet band className="min-h-[calc(100svh-4rem)] py-12 md:py-24">
      <FadeIn className={`container ${maxWidth === "5xl" ? "max-w-5xl" : "max-w-4xl"}`}>
        <SectionHeader title={title} description={description} align="center" />
        {children}
      </FadeIn>
    </NotebookSheet>
  );
}
