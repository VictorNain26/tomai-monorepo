import Link from "next/link";
import { PageLayout } from "@/components/layout/page-layout";

export default function ConfidentialitePage() {
  return (
    <PageLayout
      title="Politique de Confidentialité"
      description="Dernière mise à jour : 22 septembre 2026"
    >
      <div className="rounded-2xl bg-card p-8 shadow-sm ring-1 ring-border md:p-12">
        <div className="legal-copy">
          <p>
            <strong>En bref :</strong> TomIA aide votre enfant à apprendre. Pour cela, nous
            traitons les données strictement nécessaires au tutorat, en France et en Europe
            autant que possible. Nous ne vendons jamais vos données, nous ne diffusons aucune
            publicité, et vous gardez le contrôle : consultation, correction et suppression
            sur simple demande.
          </p>

          <h3>1. Qui est responsable de vos données ?</h3>
          <p>
            Le responsable du traitement est Victor Lenain, entrepreneur individuel, éditeur
            de l&apos;application TomIA (voir les{" "}
            <Link href="/mentions-legales">mentions légales</Link>). Pour toute question relative à
            vos données personnelles ou pour exercer vos droits :{" "}
            <a href="mailto:contact@tomia.fr">contact@tomia.fr</a>.
          </p>

          <h3>2. Quelles données collectons-nous ?</h3>
          <p><strong>Compte parent :</strong> nom, prénom, adresse e-mail et mot de passe
            (stocké sous forme hachée). Si vous choisissez la connexion Google : prénom, nom
            et adresse e-mail transmis par Google.</p>
          <p><strong>Compte enfant :</strong> prénom, nom, identifiant de connexion choisi
            par le parent, niveau scolaire et date de naissance. Aucune adresse e-mail
            n&apos;est demandée à l&apos;enfant.</p>
          <p><strong>Contenus d&apos;apprentissage :</strong> les messages échangés avec le
            tuteur, les photos et documents d&apos;exercices envoyés, les messages vocaux et
            leur transcription, ainsi que les cartes de révision générées.</p>
          <p><strong>Personnalisation pédagogique :</strong> un profil d&apos;apprentissage
            (points forts, difficultés, style d&apos;apprentissage préféré), des résumés de
            sessions de travail conservés 90 jours, et la progression de révision.</p>
          <p><strong>Connexion Pronote (optionnelle) :</strong> si vous l&apos;activez, les
            identifiants de connexion sont stockés chiffrés (AES-256-GCM). Les devoirs, notes
            et emplois du temps sont lus à la demande depuis Pronote par nos serveurs : ils ne
            sont jamais enregistrés en base de données, et ne sont transmis à l&apos;IA que le
            temps de préparer une réponse.</p>
          <p><strong>Données techniques :</strong> adresse IP et type de navigateur lors des
            connexions (sécurité du compte), données d&apos;abonnement.</p>
          <p><strong>Site vitrine :</strong> votre adresse e-mail si vous vous inscrivez à la
            liste d&apos;attente ou nous contactez.</p>

          <h3>3. Pourquoi, et sur quelle base légale ?</h3>
          <ul>
            <li><strong>Fournir le service de tutorat</strong> (compte, conversations,
              révisions) — exécution du contrat.</li>
            <li><strong>Personnaliser la pédagogie</strong> (profil d&apos;apprentissage,
              mémoire des sessions) — exécution du contrat ; voir la section 4 ci-dessous.</li>
            <li><strong>Créer et gérer le compte d&apos;un enfant</strong> — consentement du
              titulaire de l&apos;autorité parentale et, conjointement, de l&apos;enfant
              (article 45 de la loi Informatique et Libertés pour les moins de 15 ans).</li>
            <li><strong>Connexion Pronote</strong> — consentement, activable et désactivable
              à tout moment.</li>
            <li><strong>Facturation et abonnement</strong> — exécution du contrat et
              obligation légale (conservation comptable).</li>
            <li><strong>Sécurité du service</strong> (journaux de connexion, limitation de
              débit) — intérêt légitime.</li>
            <li><strong>Liste d&apos;attente et contact</strong> — consentement.</li>
          </ul>

          <h3>4. Le profil d&apos;apprentissage, expliqué simplement</h3>
          <p>
            Pour adapter ses explications, TomIA note au fil des conversations ce que
            l&apos;élève maîtrise et ce qui lui pose des difficultés (par exemple « à
            l&apos;aise en géométrie, fractions à consolider »). Ce profil sert uniquement à
            ajuster le tutorat. Il n&apos;est jamais utilisé à des fins publicitaires, jamais
            partagé avec l&apos;établissement scolaire, et ne produit aucune décision
            automatisée ayant un effet juridique (article 22 du RGPD). Vous pouvez le
            consulter ou demander son effacement à tout moment.
          </p>
          <p>
            <strong>Pour toi, élève :</strong> Tom retient ce que tu sais déjà bien faire et
            ce qui est encore difficile, pour mieux t&apos;expliquer. Personne d&apos;autre ne
            voit ces notes, et tu peux demander à les effacer, toi-même ou avec tes parents.
          </p>

          <h3>5. Qui accède à vos données ?</h3>
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
            <li><strong>Koyeb</strong> (Union européenne — Francfort) — hébergement du
              serveur applicatif et de la base de données.</li>
            <li><strong>Vercel</strong> (États-Unis) — hébergement du site vitrine et de
              l&apos;application web.</li>
            <li><strong>Google</strong> — uniquement si vous choisissez la connexion Google.</li>
          </ul>

          <h3>6. Transferts hors de l&apos;Union européenne</h3>
          <p>
            L&apos;essentiel de vos données est traité en France et dans l&apos;Union
            européenne. Les transferts vers le prestataire établi aux États-Unis (Vercel) sont
            encadrés par le cadre de protection des données UE–États-Unis
            (Data Privacy Framework) ou, à défaut, par les clauses contractuelles types de la
            Commission européenne. Une copie de ces garanties peut être obtenue en écrivant à{" "}
            <a href="mailto:contact@tomia.fr">contact@tomia.fr</a>.
          </p>

          <h3>7. Combien de temps conservons-nous vos données ?</h3>
          <ul>
            <li><strong>Compte et contenus d&apos;apprentissage</strong> (messages, fichiers,
              profil, cartes de révision) : pendant l&apos;utilisation du service, puis
              effacés dans un délai de 30 jours après la suppression du compte.</li>
            <li><strong>Compte inactif</strong> : supprimé après 3 ans sans connexion, après
              relance par e-mail.</li>
            <li><strong>Résumés de sessions de travail</strong> (mémoire pédagogique) :
              90 jours.</li>
            <li><strong>Sessions de connexion</strong> : 7 jours.</li>
            <li><strong>Journaux techniques et de sécurité</strong> : 12 mois.</li>
            <li><strong>Identifiants Pronote chiffrés</strong> : jusqu&apos;à la déconnexion
              de Pronote ou la suppression du compte.</li>
            <li><strong>Données de facturation</strong> : 10 ans (obligation comptable).</li>
          </ul>

          <h3>8. Vos droits</h3>
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

          <h3>9. Sécurité</h3>
          <p>
            Les échanges sont chiffrés (TLS). Les identifiants Pronote sont chiffrés en
            AES-256-GCM avec une dérivation de clé PBKDF2 à 600 000 itérations et un sel
            aléatoire par enregistrement. Les cookies de session sont protégés (httpOnly, secure) et
            l&apos;accès aux données d&apos;un enfant est strictement réservé à son parent.
          </p>

          <h3>10. Protection des mineurs</h3>
          <p>
            TomIA est conçu pour des élèves mineurs, sous le contrôle de leurs parents : le
            compte enfant est créé par le parent, et pour les enfants de moins de 15 ans le
            traitement repose sur le consentement conjoint du parent et de l&apos;enfant
            (article 45 de la loi Informatique et Libertés). Aucune publicité n&apos;est
            diffusée, aucun profil n&apos;est exploité à des fins commerciales, et
            l&apos;information destinée aux élèves est rédigée en langage simple,
            conformément aux recommandations de la CNIL sur les droits numériques des
            mineurs.
          </p>

          <h3>11. Évolution de cette politique</h3>
          <p>
            En cas de modification substantielle de cette politique, vous serez informé par
            e-mail ou via l&apos;application avant son entrée en vigueur. La date de dernière
            mise à jour figure en haut de cette page.
          </p>
        </div>
      </div>
    </PageLayout>
  );
}
