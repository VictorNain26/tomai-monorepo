import { PageLayout } from "@/components/layout/page-layout";

export default function MentionsLegalesPage() {
  return (
    <PageLayout title="Mentions Légales">
      <div className="relative mt-12">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-blue-600/20 rounded-[2.5rem] blur-xl opacity-50" />
        <div className="relative bg-card/80 backdrop-blur-xl border border-border/50 rounded-[2rem] p-8 md:p-12 shadow-2xl">
          <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
            <h3>Éditeur du site</h3>
            <p>
              Le site Tom est édité par Victor Lenain, micro-entrepreneur.
            </p>
            <p>
              <strong>Directeur de la publication :</strong> Victor Lenain
            </p>

            <h3>Hébergement</h3>
            <p>
              Le site est hébergé par Vercel Inc.<br />
              340 S Lemon Ave #4133<br />
              Walnut, CA 91789<br />
              États-Unis
            </p>

            <h3>Propriété intellectuelle</h3>
            <p>
              L&apos;ensemble de ce site relève de la législation française et internationale sur le droit d&apos;auteur et la propriété intellectuelle. Tous les droits de reproduction sont réservés, y compris pour les documents téléchargeables et les représentations iconographiques et photographiques.
            </p>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
