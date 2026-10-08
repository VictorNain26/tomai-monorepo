import tomHead from '@repo/ui/assets/tom-tete.png';

/** Tom's head, beside what he says: decorative, his name is read with it. */
export function TomHead({ className }: { className?: string }) {
  return <img src={tomHead} alt="" width={128} height={128} className={className} />;
}
