import { BrainCircuit, BarChart3, BookOpen, ShieldCheck, CreditCard, GraduationCap, MessageSquareX, Globe } from "lucide-react";

export const FAQS = [
  {
    question: "TomIA donne-t-il les réponses à mon enfant ?",
    answer: "Non, jamais. TomIA utilise la méthode socratique : il pose des questions pour guider votre enfant vers la solution. Votre enfant comprend et retient, au lieu de copier et oublier.",
    icon: BrainCircuit,
  },
  {
    question: "Quelle différence avec ChatGPT ou Photomath ?",
    answer: "ChatGPT et Photomath donnent les réponses — votre enfant oublie demain. TomIA pose les bonnes questions pour faire comprendre durablement. En plus, TomIA adapte ses explications au niveau de la classe, se connecte à Pronote, et vous donne un tableau de bord parental. C'est un tuteur, pas un moteur de réponses.",
    icon: MessageSquareX,
  },
  {
    question: "TomIA est-il compatible avec Pronote ?",
    answer: "Oui, TomIA se connecte à Pronote pour voir l'emploi du temps du jour, les devoirs de la semaine et les dernières notes. L'accompagnement part de ce que votre enfant a réellement à faire.",
    icon: GraduationCap,
  },
  {
    question: "Comment puis-je suivre les progrès de mon enfant ?",
    answer: "Votre espace parent montre, pour chaque enfant, le temps passé avec TomIA, le nombre de sessions et les jours d'activité de la semaine. Si Pronote est connecté, vous y voyez aussi ses dernières notes et ses devoirs à venir.",
    icon: BarChart3,
  },
  {
    question: "TomIA s'adapte-t-il au niveau de mon enfant ?",
    answer: "Oui. TomIA s'adresse aux collégiens, de la 6e à la 3e : il adapte son vocabulaire, la longueur de ses explications et la notation mathématique à la classe de votre enfant. Il couvre 10 matières : Maths, Français, Histoire-Géo, SVT, Physique-Chimie, Technologie, Anglais, Espagnol, Allemand et Italien.",
    icon: BookOpen,
  },
  {
    question: "Mes données sont-elles en sécurité ?",
    answer: "Absolument. Vos données sont hébergées dans l'Union européenne, conformément au RGPD : serveur et base de données à Francfort, fichiers à Paris. Nous ne vendons jamais vos informations et n'affichons aucune publicité. La confidentialité de votre famille est notre priorité.",
    icon: ShieldCheck,
  },
  {
    question: "Puis-je annuler à tout moment ?",
    answer: "Oui, l'offre gratuite, avec un volume d'échanges limité chaque jour, reste accessible sans limite de durée. L'abonnement payant ouvrira après le lancement ; il sera sans engagement et ses modalités de souscription et de résiliation seront publiées à son ouverture.",
    icon: CreditCard,
  },
  {
    question: "Sur quels appareils TomIA est-il disponible ?",
    answer: "TomIA est un service web : il s'utilise dans le navigateur, sur ordinateur, tablette ou téléphone, sans rien installer.",
    icon: Globe,
  },
];
