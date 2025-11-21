import { SectionHeader } from "@/components/atoms/section-header";
import { FadeIn } from "@/components/atoms/fade-in";

export default function MentionsLegalesPage() {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] py-12 md:py-24 px-4 overflow-hidden">
      <FadeIn className="container mx-auto max-w-4xl">
        <SectionHeader
          title="Mentions Légales"
          align="center"
        />

        <div className="relative mt-12">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-blue-600/20 rounded-[2.5rem] blur-xl opacity-50" />
          <div className="relative bg-card/80 backdrop-blur-xl border border-border/50 rounded-[2rem] p-8 md:p-12 shadow-2xl">
            <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
              <h3>Éditeur du site</h3>
              <p>
                Le site TomIA est édité par la société TomIA SAS, société par actions simplifiée au capital de 10 000 euros, immatriculée au Registre du Commerce et des Sociétés de Paris sous le numéro 123 456 789.
              </p>
              <p>
                <strong>Siège social :</strong><br />
                123 Avenue de l&apos;Innovation<br />
                75001 Paris, France
              </p>
              <p>
                <strong>Directeur de la publication :</strong> Monsieur Thomas IA
              </p>
              <p>
                <strong>Contact :</strong> contact@tomai.fr
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
      </FadeIn>
    </div>
  );
}
