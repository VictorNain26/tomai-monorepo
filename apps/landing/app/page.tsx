import { Hero } from '@/components/sections/hero';
import { Problem } from '@/components/sections/problem';
import { Parents } from '@/components/sections/parents';
import { Trust } from '@/components/sections/trust';
import { HowItWorks } from '@/components/sections/how-it-works';
import { Pricing } from '@/components/sections/pricing';
import { FAQ } from '@/components/sections/faq';
import { FAQS } from '@/components/sections/faq-data';
import { JsonLd } from '@/components/json-ld';

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map(({ question, answer }) => ({
    '@type': 'Question',
    name: question,
    acceptedAnswer: { '@type': 'Answer', text: answer },
  })),
};

export default function HomePage() {
  return (
    <>
      <JsonLd data={faqJsonLd} />
      <Hero />
      <Problem />
      <HowItWorks />
      <Parents />
      <Trust />
      <Pricing />
      <FAQ />
    </>
  );
}
