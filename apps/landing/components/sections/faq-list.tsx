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
            className="w-full flex items-center justify-between p-6 text-left min-h-11 focus-visible:ring-inset"
          >
            <div className="flex items-center gap-4">
              {faq.icon && (
                <div className={`flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full shrink-0 ${openIndex === index ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'} transition-colors`}>
                  <faq.icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
              )}
              <span className="font-semibold text-base sm:text-lg text-foreground">
                {faq.question}
              </span>
            </div>
            <ChevronDown
              className={`h-5 w-5 text-muted-foreground transition-transform duration-base shrink-0 ml-2 ${openIndex === index ? "rotate-180" : ""}`}
            />
          </button>

          <AnimatePresence>
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
                <div className="px-6 pb-6 pl-[3.25rem] sm:pl-20 text-muted-foreground">
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
