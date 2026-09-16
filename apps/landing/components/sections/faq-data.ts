import { BrainCircuit, BarChart3, BookOpen, ShieldCheck, CreditCard, GraduationCap, MessageSquareX, Smartphone } from "lucide-react";

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
    answer: "Oui. Du CP à la Terminale, TomIA adapte son vocabulaire, la longueur de ses explications et la notation mathématique à l'âge et à la classe de votre enfant. Il couvre 13 matières : Maths, Français, Histoire, Géographie, SVT, Physique-Chimie, Anglais, Philosophie…",
    icon: BookOpen,
  },
  {
    question: "Mes données sont-elles en sécurité ?",
    answer: "Absolument. Vos données sont hébergées dans l'Union européenne, conformément au RGPD : serveur et base de données à Francfort, fichiers à Paris. Nous ne vendons jamais vos informations et n'affichons aucune publicité. La confidentialité de votre famille est notre priorité.",
    icon: ShieldCheck,
  },
  {
    question: "Puis-je annuler à tout moment ?",
    answer: "Oui, l'abonnement est sans engagement. Vous pouvez annuler en un clic depuis votre espace parent, sans frais ni justification. L'offre gratuite, avec un volume d'échanges limité chaque jour, reste accessible sans limite de durée.",
    icon: CreditCard,
  },
  {
    question: "Sur quels appareils TomIA est-il disponible ?",
    answer: "TomIA est disponible en application mobile sur iOS et Android. Votre enfant peut travailler depuis son smartphone ou sa tablette, à la maison ou en déplacement.",
    icon: Smartphone,
  },
];
