"use client";

import { useState, useEffect } from "react";
import { Button } from "@repo/ui";

export function MobileCTABar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 500);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-40 md:hidden bg-background/95 backdrop-blur-md border-t border-border p-4 transition-transform duration-300 ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <Button className="w-full" size="lg" asChild>
        <a href="#waitlist">
          Rejoindre la liste d&apos;attente
        </a>
      </Button>
    </div>
  );
}
