import { SectionHeader } from "@/components/atoms/section-header";
import { FadeIn } from "@/components/atoms/fade-in";

export default function CguPage() {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] py-12 md:py-24 px-4 overflow-hidden">
      <FadeIn className="container mx-auto max-w-4xl">
        <SectionHeader
          title="Conditions Générales d'Utilisation"
          description="Dernière mise à jour : 21 Novembre 2025"
          align="center"
        />

        <div className="relative mt-12">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-blue-600/20 rounded-[2.5rem] blur-xl opacity-50" />
          <div className="relative bg-card/80 backdrop-blur-xl border border-border/50 rounded-[2rem] p-8 md:p-12 shadow-2xl">
            <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
              <h3>1. Objet</h3>
              <p>
                Les présentes Conditions Générales d&apos;Utilisation ont pour objet de définir les modalités de mise à disposition des services du site TomIA, ci-après nommé « le Service » et les conditions d&apos;utilisation du Service par l&apos;Utilisateur.
              </p>

              <h3>2. Accès au service</h3>
              <p>
                Le Service est accessible gratuitement à tout Utilisateur disposant d&apos;un accès à internet. Tous les coûts afférents à l&apos;accès au Service, que ce soient les frais matériels, logiciels ou d&apos;accès à internet sont exclusivement à la charge de l&apos;utilisateur. Il est seul responsable du bon fonctionnement de son équipement informatique ainsi que de son accès à internet.
              </p>

              <h3>3. Propriété intellectuelle</h3>
              <p>
                La structure générale du site TomIA, ainsi que les textes, graphiques, images, sons et vidéos la composant, sont la propriété de l&apos;éditeur ou de ses partenaires. Toute représentation et/ou reproduction et/ou exploitation partielle ou totale des contenus et services proposés par le site TomIA, par quelque procédé que ce soit, sans l&apos;autorisation préalable et par écrit de TomIA est strictement interdite et serait susceptible de constituer une contrefaçon au sens des articles L 335-2 et suivants du Code de la propriété intellectuelle.
              </p>

              <h3>4. Données personnelles</h3>
              <p>
                Les informations demandées à l&apos;inscription au site sont nécessaires et obligatoires pour la création du compte de l&apos;Utilisateur. En particulier, l&apos;adresse électronique pourra être utilisée par le site pour l&apos;administration, la gestion et l&apos;animation du service.
                Le site assure à l&apos;Utilisateur une collecte et un traitement d&apos;informations personnelles dans le respect de la vie privée conformément à la loi n°78-17 du 6 janvier 1978 relative à l&apos;informatique, aux fichiers et aux libertés.
              </p>

              <h3>5. Responsabilité</h3>
              <p>
                Les informations diffusées sur le site TomIA sont présentées à titre purement informatif et ne sauraient en aucun cas engager la responsabilité de TomIA. Bien que TomIA s&apos;efforce de fournir des informations fiables, elle ne garantit pas l&apos;exactitude, la complétude et l&apos;actualité des informations diffusées.
              </p>
            </div>
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
