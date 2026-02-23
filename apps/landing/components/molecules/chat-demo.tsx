"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, User } from "lucide-react";

interface Message {
  role: "student" | "ai";
  text: string;
}

interface Example {
  subject: string;
  level: string;
  emoji: string;
  conversation: Message[];
}

const EXAMPLES: Example[] = [
  {
    subject: "Français",
    level: "CE2",
    emoji: "📖",
    conversation: [
      { role: "student", text: "C'est quoi un adjectif ?" },
      { role: "ai", text: "Dans « un grand chien », quel mot décrit le chien ?" },
      { role: "student", text: "« Grand » ! Ça dit comment il est !" },
      { role: "ai", text: "Exactement, c'est ça un adjectif. Tu l'as trouvé tout seul !" },
    ],
  },
  {
    subject: "Maths",
    level: "4ème",
    emoji: "🧮",
    conversation: [
      { role: "student", text: "Pythagore, j'y comprends rien." },
      { role: "ai", text: "Triangle rectangle, côtés de 3 et 4. Combien font 3² + 4² ?" },
      { role: "student", text: "9 + 16 = 25... et √25 = 5 !" },
      { role: "ai", text: "Tu viens d'appliquer Pythagore sans t'en rendre compte !" },
    ],
  },
  {
    subject: "Physique-Chimie",
    level: "Terminale",
    emoji: "🔬",
    conversation: [
      { role: "student", text: "Fission et fusion, c'est quoi la différence ?" },
      { role: "ai", text: "Quand tu casses une noix en deux, tu rassembles ou tu sépares ?" },
      { role: "student", text: "Séparer... fission = séparer, fusion = rassembler ?" },
      { role: "ai", text: "Exactement. La fission sépare un noyau, la fusion assemble des petits." },
    ],
  },
];

const CYCLE_INTERVAL = 8000;

function ChatBubble({ message, index }: { message: Message; index: number }) {
  const isStudent = message.role === "student";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.2, duration: 0.3 }}
      className={`flex items-end gap-2.5 ${isStudent ? "flex-row-reverse" : ""}`}
    >
      <div
        className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
          isStudent ? "bg-muted-foreground/80" : "bg-primary"
        }`}
      >
        {isStudent ? (
          <User className="h-3.5 w-3.5 text-white" />
        ) : (
          <Bot className="h-3.5 w-3.5 text-primary-foreground" />
        )}
      </div>

      <div
        className={`px-4 py-2.5 text-sm leading-relaxed max-w-[78%] shadow-sm ${
          isStudent
            ? "bg-secondary text-secondary-foreground rounded-2xl rounded-br-md"
            : "bg-primary/10 text-foreground rounded-2xl rounded-bl-md"
        }`}
      >
        {message.text}
      </div>
    </motion.div>
  );
}

function ChatCard({ example }: { example: Example }) {
  return (
    <div className="bg-card border border-border/50 ring-1 ring-border/20 rounded-2xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border/40">
        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
          <Bot className="h-4 w-4 text-primary-foreground" />
        </div>
        <p className="text-sm font-semibold text-foreground flex-1">TomIA</p>
        <span className="text-xs font-medium text-muted-foreground bg-secondary px-2.5 py-1 rounded-full">
          {example.emoji} {example.subject} · {example.level}
        </span>
      </div>

      {/* Conversation */}
      <div className="px-4 py-5 space-y-4">
        {example.conversation.map((msg, i) => (
          <ChatBubble key={i} message={msg} index={i} />
        ))}
      </div>
    </div>
  );
}

function CyclingChat() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % EXAMPLES.length);
    }, CYCLE_INTERVAL);
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.35, ease: "easeInOut" }}
        >
          <ChatCard example={EXAMPLES[index]} />
        </motion.div>
      </AnimatePresence>

      {/* Dots indicator */}
      <div className="flex items-center justify-center gap-2 mt-4">
        {EXAMPLES.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            aria-label={`Exemple ${EXAMPLES[i].subject}`}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === index
                ? "w-6 bg-primary"
                : "w-2 bg-border hover:bg-muted-foreground/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function ChatSkeleton() {
  return (
    <div className="bg-card border border-border/50 rounded-2xl shadow-lg overflow-hidden animate-pulse">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border/40">
        <div className="h-8 w-8 rounded-full bg-muted" />
        <div className="h-4 bg-muted rounded w-16" />
      </div>
      <div className="px-4 py-5 space-y-4">
        {[false, true, false, true].map((reverse, i) => (
          <div key={i} className={`flex gap-2.5 ${reverse ? "flex-row-reverse" : ""}`}>
            <div className="w-7 h-7 rounded-full bg-muted shrink-0" />
            <div className="h-10 bg-muted rounded-2xl flex-1 max-w-[78%]" />
          </div>
        ))}
      </div>
    </div>
  );
}

const DynamicChat = dynamic(() => Promise.resolve(CyclingChat), {
  ssr: false,
  loading: ChatSkeleton,
});

export function ChatDemo() {
  return (
    <div className="relative mx-auto w-full max-w-lg">
      {/* Glow */}
      <div className="absolute -inset-3 bg-gradient-to-r from-primary/15 to-violet/15 rounded-3xl blur-2xl opacity-60" />

      <div className="relative">
        <DynamicChat />
      </div>
    </div>
  );
}
