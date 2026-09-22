import { WaitlistForm } from "../molecules/waitlist-form";

export function CTA() {
  return (
    <section id="waitlist" className="bg-seyes scroll-mt-20 py-24">
      <div className="container">
        <div className="mx-auto max-w-4xl rounded-2xl bg-foreground px-6 py-14 text-center text-background sm:px-16">
          <h2 className="text-4xl font-semibold text-balance sm:text-5xl">Soyez prévenu du lancement</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg opacity-80">
            Tom arrive bientôt, dans le navigateur. Laissez votre email pour être prévenu de l&apos;ouverture.
          </p>
          <WaitlistForm source="cta-bottom" tone="inverted" className="mx-auto mt-8 max-w-lg" />
        </div>
      </div>
    </section>
  );
}
