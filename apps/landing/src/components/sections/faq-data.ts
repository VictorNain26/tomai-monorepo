import { ChartColumn, BookOpen, BrainCircuit, Cpu, CreditCard, Globe, MessageSquareX, ShieldCheck } from '@lucide/astro';

export const FAQS = [
  {
    question: 'Tom donne-t-il les réponses à mon enfant ?',
    answer:
      "Tom est conçu pour ne pas donner la réponse de ses exercices. Il repérera d'abord l'erreur, puis aidera par étapes : une question, un indice, une étape. Si votre enfant bloque encore, Tom pourra dérouler un exemple voisin, entièrement résolu, dont votre enfant appliquera ensuite la méthode à son exercice. Nous publierons nos mesures avant l'ouverture.",
    icon: BrainCircuit,
  },
  {
    question: 'Quelle différence avec ChatGPT ou une appli qui résout les exercices ?',
    answer:
      "Une appli qui résout sur photo rend la solution, et une IA généraliste peut la donner dès qu'on la lui demande. Tom n'aura qu'une façon de faire : faire réfléchir. Il s'adressera aux seuls collégiens, et vous tiendra informé par un résumé.",
    icon: MessageSquareX,
  },
  {
    question: "Tom s'adapte-t-il au niveau de mon enfant ?",
    answer: "Tom est conçu pour les collégiens, de la 6e à la 3e, et pour leur parler comme en classe. Nous le mesurerons avant l'ouverture.",
    icon: BookOpen,
  },
  {
    question: 'Comment suivre le travail de mon enfant ?',
    answer:
      "L'espace parent montrera un résumé : matières travaillées, temps passé, notions qui résistent. Il ne montrera pas les conversations : votre enfant gardera un espace à lui.",
    icon: ChartColumn,
  },
  {
    question: 'Quelle IA utilisez-vous ?',
    answer: "Tom s'appuie sur les modèles de Mistral AI, une entreprise française, appelés sur leur infrastructure européenne.",
    icon: Cpu,
  },
  {
    question: 'Que deviendront les données de mon enfant ?',
    answer:
      "Aujourd'hui, aucune donnée d'élève n'est collectée : l'application n'est pas encore ouverte. Les messages de votre enfant seront traités par les modèles de Mistral AI, sur leur infrastructure européenne. Nous ne vendrons jamais vos données et n'afficherons aucune publicité.",
    icon: ShieldCheck,
  },
  {
    question: 'Puis-je annuler à tout moment ?',
    answer:
      "L'offre gratuite, avec un volume d'échanges limité chaque jour, restera accessible sans limite de durée. L'abonnement Complet ouvrira après le lancement, sans engagement ; ses modalités seront publiées à son ouverture.",
    icon: CreditCard,
  },
  {
    question: "Sur quels appareils l'utiliser ?",
    answer:
      "Ce sera un service web, pensé d'abord pour le téléphone : il s'utilisera dans le navigateur, sur téléphone, tablette ou ordinateur, sans rien installer.",
    icon: Globe,
  },
];
