import { SectionHeader } from "@/components/atoms/section-header";
import { FadeIn } from "@/components/atoms/fade-in";

export default function ConfidentialitePage() {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] py-12 md:py-24 px-4 overflow-hidden">
      <FadeIn className="container mx-auto max-w-4xl">
        <SectionHeader
          title="Politique de Confidentialité"
          description="Dernière mise à jour : 21 Novembre 2025"
          align="center"
        />

        <div className="relative mt-12">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-blue-600/20 rounded-[2.5rem] blur-xl opacity-50" />
          <div className="relative bg-card/80 backdrop-blur-xl border border-border/50 rounded-[2rem] p-8 md:p-12 shadow-2xl">
            <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
              <h3>1. Collecte de l&apos;information</h3>
              <p>
                Nous recueillons des informations lorsque vous vous inscrivez sur notre site, lorsque vous vous connectez à votre compte, faites un achat, participez à un concours, et / ou lorsque vous vous déconnectez. Les informations recueillies incluent votre nom, votre adresse e-mail, numéro de téléphone, et / ou carte de crédit.
              </p>

              <h3>2. Utilisation des informations</h3>
              <p>
                Toutes les informations que nous recueillons auprès de vous peuvent être utilisées pour :
              </p>
              <ul>
                <li>Personnaliser votre expérience et répondre à vos besoins individuels</li>
                <li>Fournir un contenu publicitaire personnalisé</li>
                <li>Améliorer notre site Web</li>
                <li>Améliorer le service client et vos besoins de prise en charge</li>
                <li>Vous contacter par e-mail</li>
                <li>Administrer un concours, une promotion, ou une enquête</li>
              </ul>

              <h3>3. Confidentialité du commerce en ligne</h3>
              <p>
                Nous sommes les seuls propriétaires des informations recueillies sur ce site. Vos informations personnelles ne seront pas vendues, échangées, transférées, ou données à une autre société pour n&apos;importe quelle raison, sans votre consentement, en dehors de ce qui est nécessaire pour répondre à une demande et / ou une transaction, comme par exemple pour expédier une commande.
              </p>

              <h3>4. Divulgation à des tiers</h3>
              <p>
                Nous ne vendons, n&apos;échangeons et ne transférons pas vos informations personnelles identifiables à des tiers. Cela ne comprend pas les tierce parties de confiance qui nous aident à exploiter notre site Web ou à mener nos affaires, tant que ces parties conviennent de garder ces informations confidentielles.
              </p>

              <h3>5. Protection des informations</h3>
              <p>
                Nous mettons en œuvre une variété de mesures de sécurité pour préserver la sécurité de vos informations personnelles. We use a cryptage à la pointe de la technologie pour protéger les informations sensibles transmises en ligne. Nous protégeons également vos informations hors ligne. Seuls les employés qui ont besoin d&apos;effectuer un travail spécifique (par exemple, la facturation ou le service à la clientèle) ont accès aux informations personnelles identifiables.
              </p>

              <h3>6. Consentement</h3>
              <p>
                En utilisant notre site, vous consentez à notre politique de confidentialité.
              </p>
            </div>
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
