import type { Metadata } from "next";
import Link from "next/link";
import { PageLayout } from "@/components/layout/page-layout";
import { BRAND_NAME } from "@/lib/brand";

const DESCRIPTION = `Comment ${BRAND_NAME} protégera les données de votre enfant\u00a0: données collectées, bases légales, prestataires, durées de conservation et vos droits.`;

export const metadata: Metadata = {
  title: "Politique de Confidentialité",
  description: DESCRIPTION,
  alternates: {
    canonical: "/confidentialite",
  },
};

export default function ConfidentialitePage() {
  return (
    <PageLayout
      title="Politique de Confidentialité"
      description="Dernière mise à jour : 1er octobre 2026"
      maxWidth="3xl"
    >
      <div className="legal-copy">
        <p>
          <strong>Service en préparation&nbsp;:</strong> cette politique décrit le service tel
          qu&apos;il fonctionnera à son ouverture. L&apos;application n&apos;est pas encore
          ouverte&nbsp;: aujourd&apos;hui, aucune donnée d&apos;élève n&apos;est collectée.
        </p>
        <p>
          <strong>En bref :</strong> {BRAND_NAME} est conçu pour aider votre enfant à
          apprendre. Pour cela, nous traitons les données strictement nécessaires au
          tutorat, en France et en Europe autant que possible. Nous ne vendons jamais vos données, nous ne diffusons aucune
          publicité, et vous gardez le contrôle : consultation, correction et suppression
          sur simple demande.
        </p>

        <h2>1. Qui est responsable de vos données ?</h2>
        <p>
          Le responsable du traitement est Victor Lenain, entrepreneur individuel, éditeur
          de l&apos;application {BRAND_NAME} (voir les{" "}
          <Link href="/mentions-legales">mentions légales</Link>). Pour toute question relative à
          vos données personnelles ou pour exercer vos droits :{" "}
          <a href="mailto:contact@tomia.fr">contact@tomia.fr</a>.
        </p>

        <h2>2. Quelles données collectons-nous ?</h2>
        <p><strong>Compte parent :</strong> nom, prénom, adresse e-mail et mot de passe
          (stocké sous forme hachée). Si vous choisissez la connexion Google : prénom, nom
          et adresse e-mail transmis par Google.</p>
        <p><strong>Compte enfant :</strong> prénom, nom, identifiant de connexion choisi
          par le parent, niveau scolaire et date de naissance. Aucune adresse e-mail
          n&apos;est demandée à l&apos;enfant.</p>
        <p><strong>Contenus d&apos;apprentissage :</strong> les messages échangés avec le
          tuteur, les photos et documents d&apos;exercices envoyés, les messages vocaux et
          leur transcription, ainsi que les cartes de révision générées.</p>
        <p><strong>Suivi de la séance :</strong> un résumé de la conversation en cours, pour
          que le tuteur garde le fil, et la progression de révision.</p>
        <p><strong>Données techniques :</strong> adresse IP et type de navigateur lors des
          connexions (sécurité du compte), données d&apos;abonnement.</p>
        <p><strong>Site vitrine :</strong> votre adresse e-mail si vous nous contactez.</p>

        <h2>3. Pourquoi, et sur quelle base légale ?</h2>
        <ul>
          <li><strong>Fournir le service de tutorat</strong> (compte, conversations,
            révisions) — exécution du contrat.</li>
          <li><strong>Créer et gérer le compte d&apos;un enfant</strong> — consentement du
            titulaire de l&apos;autorité parentale et, conjointement, de l&apos;enfant
            (article 45 de la loi Informatique et Libertés pour les moins de 15 ans).</li>
          <li><strong>Facturation et abonnement</strong> — exécution du contrat et
            obligation légale (conservation comptable).</li>
          <li><strong>Sécurité du service</strong> (journaux de connexion, limitation de
            débit) — intérêt légitime.</li>
          <li><strong>Contact</strong> — consentement.</li>
        </ul>

        <h2>4. Aucun profil d&apos;apprentissage</h2>
        <p>
          {BRAND_NAME} ne tient aucun profil de l&apos;élève : une séance ne sert pas à la
          suivante. Pendant une séance, un résumé de la conversation lui sert à garder le
          fil ; il ne produit aucune décision automatisée ayant un effet juridique (article 22
          du RGPD).
        </p>
        <p>
          <strong>Pour toi, élève :</strong> Tom ne prend pas de notes sur toi. Il se souvient de
          ce que vous vous êtes dit pendant la séance ; une nouvelle séance repart de zéro.
        </p>

        <h2>5. Qui accède à vos données ?</h2>
        <p>
          Vos données ne sont jamais vendues ni louées, et nous ne diffusons aucune
          publicité. Elles sont traitées par les prestataires suivants, chacun limité à sa
          mission :
        </p>
        <ul>
          <li><strong>Mistral AI</strong> (France) — modèles d&apos;intelligence
            artificielle : traite les messages, photos d&apos;exercices et messages vocaux
            (transcription) le temps de générer la réponse.</li>
          <li><strong>Scaleway</strong> (France, données stockées à Paris) — stockage des
            photos, documents et messages vocaux.</li>
          <li><strong>Vercel</strong> (États-Unis) — hébergement du site vitrine.</li>
          <li><strong>Google</strong> — uniquement si vous choisissez la connexion Google.</li>
        </ul>

        <h2>6. Transferts hors de l&apos;Union européenne</h2>
        <p>
          Mistral AI et Scaleway traitent vos données dans l&apos;Union européenne.
          L&apos;hébergeur du serveur applicatif et de la base de données n&apos;est pas
          encore choisi&nbsp;: il sera nommé ici avant l&apos;ouverture. Les transferts vers
          le prestataire établi aux États-Unis (Vercel) sont
          encadrés par le cadre de protection des données UE–États-Unis
          (Data Privacy Framework) ou, à défaut, par les clauses contractuelles types de la
          Commission européenne. Une copie de ces garanties peut être obtenue en écrivant à{" "}
          <a href="mailto:contact@tomia.fr">contact@tomia.fr</a>.
        </p>

        <h2>7. Combien de temps conservons-nous vos données ?</h2>
        <ul>
          <li><strong>Compte et contenus d&apos;apprentissage</strong> (messages, fichiers,
            cartes de révision) : pendant l&apos;utilisation du service, puis
            effacés dans un délai de 30 jours après la suppression du compte.</li>
          <li><strong>Compte inactif</strong> : supprimé après 3 ans sans connexion, après
            relance par e-mail.</li>
          <li><strong>Sessions de connexion</strong> : 7 jours.</li>
          <li><strong>Journaux techniques et de sécurité</strong> : 12 mois.</li>
          <li><strong>Données de facturation</strong> : 10 ans (obligation comptable).</li>
        </ul>

        <h2>8. Vos droits</h2>
        <p>
          Conformément au RGPD et à la loi Informatique et Libertés, vous disposez des
          droits d&apos;accès, de rectification, d&apos;effacement, de limitation,
          d&apos;opposition et de portabilité, du droit de retirer votre consentement à
          tout moment, et du droit de définir des directives sur le sort de vos données
          après votre décès. L&apos;enfant peut exercer ses droits lui-même ou par
          l&apos;intermédiaire de ses parents.
        </p>
        <p>
          Pour les exercer : <a href="mailto:contact@tomia.fr">contact@tomia.fr</a> (réponse
          sous un mois ; une vérification d&apos;identité pourra être demandée). Les comptes
          enfants peuvent être supprimés directement depuis l&apos;espace parent de
          l&apos;application ; la suppression du compte parent s&apos;effectue sur demande à
          la même adresse. Vous pouvez également adresser une réclamation à la CNIL
          (<a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">cnil.fr</a>).
        </p>

        <h2>9. Sécurité</h2>
        <p>
          Les échanges sont chiffrés (TLS). Les cookies de session sont protégés (httpOnly, secure) et
          l&apos;accès aux données d&apos;un enfant est strictement réservé à son parent.
        </p>

        <h2>10. Protection des mineurs</h2>
        <p>
          {BRAND_NAME} est conçu pour des élèves mineurs, sous le contrôle de leurs parents : le
          compte enfant est créé par le parent, et pour les enfants de moins de 15 ans le
          traitement repose sur le consentement conjoint du parent et de l&apos;enfant
          (article 45 de la loi Informatique et Libertés). Aucune publicité n&apos;est
          diffusée, aucun profil n&apos;est exploité à des fins commerciales, et
          l&apos;information destinée aux élèves est rédigée en langage simple,
          conformément aux recommandations de la CNIL sur les droits numériques des
          mineurs.
        </p>

        <h2>11. Évolution de cette politique</h2>
        <p>
          En cas de modification substantielle de cette politique, vous serez informé par
          e-mail ou via l&apos;application avant son entrée en vigueur. La date de dernière
          mise à jour figure en haut de cette page.
        </p>
      </div>
    </PageLayout>
  );
}
