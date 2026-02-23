import { PageLayout } from "@/components/layout/page-layout";

export default function ConfidentialitePage() {
  return (
    <PageLayout
      title="Politique de Confidentialité"
      description="Dernière mise à jour : 23 Février 2026"
    >
      <div className="relative mt-12">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-blue-600/20 rounded-[2.5rem] blur-xl opacity-50" />
        <div className="relative bg-card/80 backdrop-blur-xl border border-border/50 rounded-[2rem] p-8 md:p-12 shadow-2xl">
          <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
            <h3>1. Collecte de l&apos;information</h3>
            <p>
              Nous recueillons des informations lorsque vous créez un compte sur notre application mobile TomIA, lorsque vous vous connectez, ou lorsque vous utilisez nos services. Les informations recueillies incluent votre nom, votre adresse e-mail et les données d&apos;utilisation liées au tutorat de votre enfant.
            </p>

            <h3>2. Utilisation des informations</h3>
            <p>
              Toutes les informations que nous recueillons auprès de vous peuvent être utilisées pour :
            </p>
            <ul>
              <li>Personnaliser l&apos;expérience éducative de votre enfant et répondre à ses besoins individuels</li>
              <li>Améliorer notre application et nos services de tutorat</li>
              <li>Améliorer le service client et vos besoins de prise en charge</li>
              <li>Vous contacter par e-mail concernant votre compte ou nos services</li>
            </ul>

            <h3>3. Confidentialité des données</h3>
            <p>
              Nous sommes les seuls propriétaires des informations recueillies via notre application. Vos informations personnelles ne seront pas vendues, échangées, transférées, ou données à une autre société pour n&apos;importe quelle raison, sans votre consentement, en dehors de ce qui est nécessaire pour répondre à une demande et / ou fournir le service.
            </p>

            <h3>4. Divulgation à des tiers</h3>
            <p>
              Nous ne vendons, n&apos;échangeons et ne transférons pas vos informations personnelles identifiables à des tiers. Cela ne comprend pas les tierce parties de confiance qui nous aident à exploiter notre application ou à mener nos activités, tant que ces parties conviennent de garder ces informations confidentielles.
            </p>

            <h3>5. Hébergement et sécurité</h3>
            <p>
              Vos données sont hébergées en Europe, conformément au RGPD. Nous mettons en œuvre une variété de mesures de sécurité pour préserver la sécurité de vos informations personnelles, incluant le chiffrement des données sensibles. Nous ne diffusons aucune publicité et ne vendons jamais vos informations.
            </p>

            <h3>6. Consentement</h3>
            <p>
              En utilisant notre application, vous consentez à notre politique de confidentialité.
            </p>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
