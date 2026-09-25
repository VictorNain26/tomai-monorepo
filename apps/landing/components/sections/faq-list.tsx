"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown } from "lucide-react";
import { FAQS } from "./faq-data";

export function FaqList() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {FAQS.map((faq, index) => (
        <div
          key={index}
          className="bg-card rounded-2xl overflow-hidden shadow-sm ring-1 ring-border transition-shadow duration-base hover:ring-primary"
        >
          <button
            type="button"
            id={`faq-question-${index}`}
            aria-expanded={openIndex === index}
            aria-controls={`faq-answer-${index}`}
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
            className="w-full flex items-center justify-between p-4 text-left min-h-11 focus-visible:ring-inset sm:p-6"
          >
            <div className="flex items-center gap-4">
              {faq.icon && (
                <div className={`hidden size-10 items-center justify-center rounded-full shrink-0 ${openIndex === index ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'} transition-colors sm:flex`}>
                  <faq.icon className="size-5" />
                </div>
              )}
              <span className="font-bold text-base sm:text-lg text-foreground">
                {faq.question}
              </span>
            </div>
            <ChevronDown
              className={`h-5 w-5 text-muted-foreground transition-transform duration-base shrink-0 ml-2 ${openIndex === index ? "rotate-180" : ""}`}
            />
          </button>

          <AnimatePresence initial={false}>
            {openIndex === index && (
              <motion.div
                id={`faq-answer-${index}`}
                role="region"
                aria-labelledby={`faq-question-${index}`}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <div className="px-4 pb-4 text-muted-foreground sm:px-6 sm:pb-6 sm:pl-20">
                  {faq.answer}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}
