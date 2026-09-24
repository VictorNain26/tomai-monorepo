import { SectionHeader } from "@/components/atoms/section-header";
import { cn } from "@repo/ui";

const MAX_WIDTHS = {
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
} as const;

interface PageLayoutProps {
  title: string;
  description?: string;
  maxWidth?: keyof typeof MAX_WIDTHS;
  children: React.ReactNode;
}

export function PageLayout({ title, description, maxWidth = "4xl", children }: PageLayoutProps) {
  return (
    <div className={cn("container py-12 md:py-24", MAX_WIDTHS[maxWidth])}>
      <SectionHeader as="h1" title={title} description={description} align="left" className="mb-8" />
      {children}
    </div>
  );
}
