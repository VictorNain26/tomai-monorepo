import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@repo/ui';
import { BRAND_NAME } from '@/lib/brand';
import tomTete from '@/assets/tom-tete.png';

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label={`${BRAND_NAME} - Accueil`}
      className={cn(
        'inline-flex min-h-11 items-center gap-2 font-heading text-2xl font-extrabold text-primary transition-opacity duration-base hover:opacity-80',
        className,
      )}
    >
      <Image src={tomTete} alt="" sizes="40px" className="size-10" />
      {BRAND_NAME}
    </Link>
  );
}
