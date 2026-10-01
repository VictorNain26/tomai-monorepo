import { BarChart3, BookOpen, BrainCircuit, Cpu, CreditCard, GraduationCap, Globe, MessageSquareX, ShieldCheck } from "lucide-react";

export const FAQS = [
  {
    question: "Tom donne-t-il les réponses à mon enfant ?",
    answer: "Pas celles de ses exercices. Tom repère d'abord l'erreur, puis aide par étapes : une question, un indice, une étape. Si votre enfant bloque encore, Tom peut dérouler un exemple voisin, entièrement résolu, qu'il applique ensuite à son exercice. La réponse de son exercice, c'est lui qui l'écrit.",
    icon: BrainCircuit,
  },
  {
    question: "Quelle différence avec ChatGPT ou une appli qui résout les exercices ?",
    answer: "Une appli qui résout sur photo rend la solution, et une IA généraliste peut la donner dès qu'on la lui demande. Tom n'a qu'une façon de faire : il fait réfléchir. Il s'adresse aux seuls collégiens, se connecte à Pronote et vous tient informé.",
    icon: MessageSquareX,
  },
  {
    question: "Tom s'adapte-t-il au niveau de mon enfant ?",
    answer: "Oui. Tom s'adresse aux collégiens, de la 6e à la 3e. Il adapte son vocabulaire, la longueur de ses explications et les notations à la classe de votre enfant et à la matière travaillée.",
    icon: BookOpen,
  },
  {
    question: "Est-ce compatible avec Pronote ?",
    answer: "Oui. Une fois Pronote connecté, Tom voit les devoirs, les dernières notes et l'emploi du temps : l'accompagnement part de ce que votre enfant a réellement à faire.",
    icon: GraduationCap,
  },
  {
    question: "Comment suivre les progrès de mon enfant ?",
    answer: "Votre espace parent présente un résumé : matières travaillées, temps passé, notions qui résistent, et une alerte si votre enfant confie qu'il va mal. Vous n'y lisez pas ses conversations : votre enfant garde un espace à lui.",
    icon: BarChart3,
  },
  {
    question: "Quelle IA utilisez-vous ?",
    answer: "Tom s'appuie sur les modèles de Mistral AI, une entreprise française, appelés depuis leur infrastructure européenne.",
    icon: Cpu,
  },
  {
    question: "Mes données sont-elles en sécurité ?",
    answer: "Vos données sont hébergées dans l'Union européenne et traitées conformément au RGPD. Nous ne vendons jamais vos informations et n'affichons aucune publicité.",
    icon: ShieldCheck,
  },
  {
    question: "Puis-je annuler à tout moment ?",
    answer: "L'offre gratuite, avec un volume d'échanges limité chaque jour, reste accessible sans limite de durée. L'abonnement Complet ouvrira après le lancement, sans engagement ; ses modalités seront publiées à son ouverture.",
    icon: CreditCard,
  },
  {
    question: "Sur quels appareils l'utiliser ?",
    answer: "C'est un service web : il s'utilise dans le navigateur, sur ordinateur, tablette ou téléphone, sans rien installer.",
    icon: Globe,
  },
];
