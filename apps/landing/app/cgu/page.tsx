import Link from "next/link";
import { PageLayout } from "@/components/layout/page-layout";

export default function CguPage() {
  return (
    <PageLayout
      title="Conditions Générales d'Utilisation"
      description="Dernière mise à jour : 22 septembre 2026"
      maxWidth="3xl"
    >
      <div className="legal-copy">
        <h3>1. Objet</h3>
        <p>
          Les présentes Conditions Générales d&apos;Utilisation ont pour objet de définir les modalités de mise à disposition des services du service web TomIA, accessible sur tomia.fr, ci-après nommé « le Service » et les conditions d&apos;utilisation du Service par l&apos;Utilisateur.
        </p>

        <h3>2. Accès au service</h3>
        <p>
          Le Service est accessible depuis un navigateur web récent, sur ordinateur, tablette ou téléphone. L&apos;Utilisateur doit disposer d&apos;un accès à internet. Tous les coûts afférents à l&apos;accès au Service, que ce soient les frais matériels ou d&apos;accès à internet, sont exclusivement à la charge de l&apos;utilisateur. Il est seul responsable du bon fonctionnement de son équipement ainsi que de son accès à internet.
        </p>
        <p>
          La création d&apos;un compte parent est réservée aux personnes majeures. Les
          comptes destinés aux élèves mineurs sont créés et gérés par un parent (ou
          titulaire de l&apos;autorité parentale) depuis son propre compte.
        </p>

        <h3>3. Comptes enfants et autorité parentale</h3>
        <p>
          En créant un compte pour un enfant, le parent déclare être titulaire de
          l&apos;autorité parentale sur cet enfant et accepte les présentes CGU en son nom
          et au nom de l&apos;enfant. Pour les enfants de moins de 15 ans, le traitement
          des données repose sur le consentement conjoint du parent et de l&apos;enfant,
          conformément à l&apos;article 45 de la loi Informatique et Libertés.
        </p>
        <p>
          Le parent veille à l&apos;usage que son enfant fait du Service et en répond. Il
          dispose depuis son espace d&apos;un accès aux comptes de ses enfants (suivi,
          modification, suppression).
        </p>
        <p>
          <strong>Pour toi, élève :</strong> ton compte a été créé par tes parents pour
          t&apos;aider à apprendre. Utilise Tom pour comprendre tes leçons, pas pour copier
          des réponses. Tes parents peuvent voir ta progression, et tes conversations ne
          sont partagées avec personne d&apos;autre.
        </p>

        <h3>4. Propriété intellectuelle</h3>
        <p>
          L&apos;application TomIA, ainsi que les textes, graphiques, images, sons et vidéos la composant, sont la propriété de l&apos;éditeur ou de ses partenaires. Toute représentation et/ou reproduction et/ou exploitation partielle ou totale des contenus et services proposés par l&apos;application TomIA, par quelque procédé que ce soit, sans l&apos;autorisation préalable et par écrit de TomIA est strictement interdite et serait susceptible de constituer une contrefaçon au sens des articles L 335-2 et suivants du Code de la propriété intellectuelle.
        </p>

        <h3>5. Données personnelles</h3>
        <p>
          Le traitement des données personnelles des parents et des enfants (données
          collectées, finalités, bases légales, durées de conservation, prestataires,
          droits et modalités d&apos;exercice) est détaillé dans la{" "}
          <Link href="/confidentialite">politique de confidentialité</Link>, qui fait partie
          intégrante des présentes CGU. En résumé : les données sont traitées en France et
          en Europe autant que possible, ne sont jamais vendues, et aucune publicité
          n&apos;est diffusée.
        </p>

        <h3>6. Résiliation et suppression de compte</h3>
        <p>
          Le parent peut supprimer le compte d&apos;un enfant à tout moment depuis son
          espace dans l&apos;application. La suppression du compte parent (et des comptes
          enfants associés) s&apos;effectue sur demande à{" "}
          <a href="mailto:contact@tomia.fr">contact@tomia.fr</a>. Les données sont alors
          effacées dans les conditions prévues par la{" "}
          <Link href="/confidentialite">politique de confidentialité</Link>. Les modalités de souscription et de résiliation de l&apos;abonnement payant seront précisées dans les présentes conditions avant son ouverture.
        </p>

        <h3>7. Responsabilité</h3>
        <p>
          TomIA est un outil d&apos;aide aux devoirs utilisant l&apos;intelligence artificielle. Ses réponses, générées par un modèle d&apos;intelligence artificielle et adaptées au niveau scolaire déclaré, ne sauraient se substituer à l&apos;enseignement scolaire. TomIA s&apos;efforce de fournir des informations fiables mais ne garantit pas l&apos;exactitude, la complétude et l&apos;actualité de toutes les informations diffusées.
        </p>

        <h3>8. Droit applicable</h3>
        <p>
          Les présentes CGU sont soumises au droit français. En cas de litige et à défaut
          de résolution amiable, les tribunaux français seront seuls compétents,
          sous réserve des règles protectrices applicables aux consommateurs. La
          responsabilité de l&apos;éditeur ne saurait être engagée en cas de force majeure
          ou d&apos;indisponibilité du Service imputable à un tiers (hébergeur,
          fournisseur d&apos;accès).
        </p>
      </div>
    </PageLayout>
  );
}
