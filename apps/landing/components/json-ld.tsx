// Next's JSON-LD guide: a native script tag, `<` escaped so no string can close it early.
// https://nextjs.org/docs/app/guides/json-ld
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
