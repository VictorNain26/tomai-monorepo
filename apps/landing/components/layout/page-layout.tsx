import { FadeIn } from "@/components/atoms/fade-in";
import { SectionHeader } from "@/components/atoms/section-header";

interface PageLayoutProps {
  title: string;
  description?: string;
  maxWidth?: "4xl" | "5xl";
  children: React.ReactNode;
}

export function PageLayout({ title, description, maxWidth = "4xl", children }: PageLayoutProps) {
  return (
    <div className="bg-seyes min-h-[calc(100vh-4rem)] py-12 md:py-24">
      <FadeIn className={`container ${maxWidth === "5xl" ? "max-w-5xl" : "max-w-4xl"}`}>
        <SectionHeader title={title} description={description} align="center" />
        {children}
      </FadeIn>
    </div>
  );
}
