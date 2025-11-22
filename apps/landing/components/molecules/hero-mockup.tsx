"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { MessageCircle, User } from "lucide-react";

interface Message {
  role: "user" | "ai";
  text: string;
}

interface Example {
  subject: string;
  conversation: Message[];
}

const EXAMPLES: Example[] = [
  {
    subject: "Français",
    conversation: [
      { role: "user", text: "C'est quoi un adjectif ?" },
      { role: "ai", text: "Dans « un grand chien », qu'est-ce qui décrit le chien ?" },
      { role: "user", text: "C'est « grand » ! Ça dit comment il est." },
      { role: "ai", text: "Voilà, un adjectif décrit comment est quelque chose." },
    ],
  },
  {
    subject: "Mathématiques",
    conversation: [
      { role: "user", text: "Je comprends pas les fractions." },
      { role: "ai", text: "Tu coupes un gâteau en 4 parts égales. Tu en manges 1. Tu as mangé combien du gâteau ?" },
      { role: "user", text: "1 part sur 4... donc 1/4 !" },
      { role: "ai", text: "Exactement ! Une fraction c'est juste ça : une partie sur le total." },
    ],
  },
  {
    subject: "Sciences",
    conversation: [
      { role: "user", text: "Pourquoi le ciel est bleu ?" },
      { role: "ai", text: "La lumière du soleil contient toutes les couleurs. Laquelle se disperse le plus dans l'air selon toi ?" },
      { role: "user", text: "Le bleu ? C'est pour ça qu'on voit que le bleu !" },
      { role: "ai", text: "Bien raisonné ! Le bleu se disperse plus, donc on le voit partout dans le ciel." },
    ],
  },
];

function Avatar({ variant }: { variant: "user" | "ai" }) {
  const isAi = variant === "ai";
  return (
    <div
      className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center shrink-0 ${
        isAi
          ? "bg-indigo-600"
          : "bg-slate-500"
      }`}
    >
      {isAi ? (
        <MessageCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
      ) : (
        <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
      )}
    </div>
  );
}

function ChatMessage({ message, index }: { message: Message; index: number }) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 + index * 0.5, duration: 0.4 }}
      className={`flex items-end gap-2 sm:gap-3 ${isUser ? "flex-row-reverse" : ""}`}
    >
      <Avatar variant={message.role} />
      <div
        className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-xs sm:text-sm max-w-[80%] shadow-sm ${
          isUser
            ? "bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            : "bg-indigo-100 dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100"
        }`}
      >
        {message.text}
      </div>
    </motion.div>
  );
}

function ChatMockup({ example }: { example: Example }) {
  return (
    <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
      {/* Window Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-muted/30">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-500/80" />
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-yellow-500/80" />
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-500/80" />
        </div>
        <span className="ml-3 text-xs font-medium text-muted-foreground">
          TomIA – {example.subject}
        </span>
      </div>

      {/* Messages */}
      <div className="p-4 sm:p-5 space-y-5">
        {example.conversation.map((message, index) => (
          <ChatMessage key={index} message={message} index={index} />
        ))}
      </div>
    </div>
  );
}

function RandomChatMockup() {
  const randomIndex = Math.floor(Math.random() * EXAMPLES.length);
  return <ChatMockup example={EXAMPLES[randomIndex]} />;
}

function MockupSkeleton() {
  return (
    <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden animate-pulse">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-muted/30">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-muted-foreground/20" />
          <div className="w-3 h-3 rounded-full bg-muted-foreground/20" />
          <div className="w-3 h-3 rounded-full bg-muted-foreground/20" />
        </div>
      </div>
      <div className="p-5 space-y-4">
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-muted" />
          <div className="h-10 bg-muted rounded-2xl flex-1" />
        </div>
        <div className="flex gap-3 flex-row-reverse">
          <div className="w-8 h-8 rounded-full bg-muted" />
          <div className="h-10 bg-muted rounded-2xl flex-1" />
        </div>
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-muted" />
          <div className="h-10 bg-muted rounded-2xl flex-1" />
        </div>
      </div>
    </div>
  );
}

const DynamicChat = dynamic(() => Promise.resolve(RandomChatMockup), {
  ssr: false,
  loading: MockupSkeleton,
});

export function HeroMockup() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none animate-in fade-in slide-in-from-right-8 duration-1000 delay-300">
      <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-blue-600/20 rounded-2xl blur-lg opacity-30" />
      <DynamicChat />
    </div>
  );
}
