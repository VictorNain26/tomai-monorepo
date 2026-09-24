"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button, Sheet, SheetContent, SheetTitle, SheetTrigger } from "@repo/ui";
import { NavLinks } from "./nav-links";

export function MobileMenu({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className={className} aria-label="Ouvrir le menu">
          <Menu className="size-5" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent aria-describedby={undefined} className="p-6 pt-16">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <nav aria-label="Principale" className="flex flex-col gap-4">
          <NavLinks orientation="vertical" onLinkClick={() => setOpen(false)} />
          <Button asChild className="w-full">
            <Link href="/#waitlist" onClick={() => setOpen(false)}>
              S&apos;inscrire
            </Link>
          </Button>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
