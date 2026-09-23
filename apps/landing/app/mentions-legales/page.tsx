import { PageLayout } from "@/components/layout/page-layout";

export default function MentionsLegalesPage() {
  return (
    <PageLayout title="Mentions Légales">
      <div className="legal-copy">
        <h3>Éditeur du site</h3>
        <p>
          Le site tomia.fr est édité par Victor Lenain, micro-entrepreneur.
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
    </PageLayout>
  );
}
