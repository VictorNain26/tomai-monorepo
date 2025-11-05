import React, { type ReactElement, useEffect, useRef } from 'react';
import { Volume2, VolumeX, User, Brain, FileText, Image, File } from 'lucide-react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type { IMessage, UserRoleType } from '@/types';
import { Avatar, AvatarFallback } from './ui/avatar';
import AIModelBadge from './AIModelBadge';
import { getProviderInfo, hasHighFrustration, hasQuestionLevel } from '@/utils/messageUtils';
import { useAudio } from '@/lib/audioHooks';
import { useKatex } from '@/hooks/useKatex';
import { cn } from '@/lib/utils';

interface IMessageBubbleProps {
 message: IMessage;
 autoSpeak?: boolean;
 enableVoice?: boolean;
 _userRole?: UserRoleType;
 isStreaming?: boolean;
 mode?: 'primary' | 'college' | 'lycee';
}

// CodeComponent supprimé - maintenant géré par LazyCodeRenderer

// Composant pour l'affichage du niveau de question
const QuestionLevel: React.FC<{ questionLevel?: number }> = ({ questionLevel }) => {
 if (questionLevel === undefined) {
 return null;
 }
 return (
 <span className="text-muted-foreground">
 Niveau {questionLevel}/10
 </span>
 );
};

// Composant pour le conseil de frustration
const FrustrationTip: React.FC<{ metadata?: IMessage['metadata'] }> = ({ metadata }) => {
 if (!hasHighFrustration(metadata)) {
 return null;
 }
 return (
 <div className="mt-1 text-xs text-info">
 💡 Conseil: N'hésite pas à demander des indices !
 </div>
 );
};

// Composant pour afficher les fichiers attachés
const AttachedFileDisplay: React.FC<{ attachedFile: IMessage['attachedFile'] }> = ({ attachedFile }) => {
 if (!attachedFile) {
 return null;
 }

 const getFileIcon = (mimeType?: string) => {
 if (mimeType?.startsWith('image/')) {
 return <Image className="w-4 h-4" />;
 }
 if (mimeType === 'application/pdf') {
 return <FileText className="w-4 h-4" />;
 }
 return <File className="w-4 h-4" />;
 };

 const formatFileSize = (bytes?: number) => {
 if (!bytes) return '';
 if (bytes < 1024) return `${bytes} B`;
 if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
 return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
 };

 return (
 <div className="mt-2 p-2 bg-info/10 rounded-lg border border-info/20">
 <div className="flex items-center gap-2">
 <div className="p-1 bg-background rounded-sm shadow-xs border border-border">
 {getFileIcon(attachedFile.mimeType)}
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium text-foreground truncate">
 📎 {attachedFile.fileName}
 </p>
 {attachedFile.fileSizeBytes && (
 <p className="text-xs text-muted-foreground">
 {formatFileSize(attachedFile.fileSizeBytes)}
 </p>
 )}
 </div>
 </div>
 </div>
 );
};

const _MessageMetadata: React.FC<{
 isUser: boolean;
 providerInfo: { name: string; tier: string } | null;
 metadata?: IMessage['metadata'];
}> = ({ isUser, providerInfo, metadata }) => {
 if (isUser || providerInfo == null) {
 return null;
 }

 return (
 <>
 <div className="mt-2 sm:mt-3 flex items-center justify-between text-xs sm:text-sm">
 <AIModelBadge
 model={providerInfo.name}
 isFallback={false}
 />
 {hasQuestionLevel(metadata) && metadata?.questionLevel !== undefined && <QuestionLevel questionLevel={metadata.questionLevel} />}
 </div>
 <FrustrationTip metadata={metadata} />
 </>
 );
};

// Composants Markdown supprimés - maintenant gérés par LazyMarkdownRenderer

export function MessageBubble({
 message,
 autoSpeak = false,
 enableVoice = true,
 _userRole = 'student',
 mode = 'college'
}: IMessageBubbleProps): ReactElement {
 const isUser = message.role === 'user';
 const providerInfo = getProviderInfo(message);
 const audio = useAudio();
 const { loadKatex } = useKatex(); // Lazy load KaTeX pour performance
 const hasBeenSpokenRef = useRef(false);

 // Détection contenu mathématique pour trigger KaTeX lazy loading - Patterns Backend 2025
 useEffect(() => {
   if (!isUser && message.content && typeof message.content === 'string') {
     // Détection formules math selon backend TomAI (cf. ai-orchestrator.service.ts)
     const hasMath = (
       // LaTeX standard: $...$ ou $$...$$
       /\$[^$]+\$|\$\$[^$]+\$\$/.test(message.content) ||
       // LaTeX inline/display: \(...\) ou \[...\]
       /\\?\([^)]+\\?\)|\\?\[[^\]]+\\?\]/.test(message.content) ||
       // Fractions LaTeX: \\frac{a}{b}
       /\\\\?frac\{[^}]+\}\{[^}]+\}/.test(message.content) ||
       // Racines: \\sqrt{a}
       /\\\\?sqrt\{[^}]+\}/.test(message.content) ||
       // Puissances/indices: a^2, a_2
       /[a-zA-Z0-9]\^[a-zA-Z0-9{}]+|[a-zA-Z0-9]_[a-zA-Z0-9{}]+/.test(message.content) ||
       // Fonctions: f(x), sin, cos, etc.
       /[a-zA-Z]+\([^)]*\)|\\?(?:sin|cos|tan|log|ln|lim)/.test(message.content) ||
       // Ensembles: \\in, \\subset, \\cap, \\cup
       /\\\\?(?:in|subset|cap|cup|setminus)/.test(message.content) ||
       // Systèmes: \\begin{cases}
       /\\\\?begin\{cases\}/.test(message.content) ||
       // Intégrales: \\int
       /\\\\?int[_^]?/.test(message.content)
     );

     if (hasMath) {
       loadKatex(); // Charger KaTeX uniquement si maths détectées
     }
   }
 }, [message.content, isUser, loadKatex]);

 // 🧠 Configuration adaptative selon l'âge pour réduire charge cognitive
 const ageConfig = {
   primary: {
     avatarSize: 'w-14 h-14', // Plus grand pour attirer l'attention
     borderRadius: 'rounded-3xl', // Plus arrondi, plus ludique
     textSize: 'text-base', // Plus grand pour faciliter lecture
     spacing: 'gap-4 mb-6', // Plus d'espace entre messages
     animations: true, // Animations ludiques
     showMetadata: false, // Masquer métadonnées complexes
     maxWidth: 'max-w-[95%]' // Plus large pour confort lecture
   },
   college: {
     avatarSize: 'w-12 h-12',
     borderRadius: 'rounded-2xl',
     textSize: 'text-sm',
     spacing: 'gap-3 mb-4',
     animations: true,
     showMetadata: true,
     maxWidth: 'max-w-[85%]'
   },
   lycee: {
     avatarSize: 'w-10 h-10', // Plus compact, plus mature
     borderRadius: 'rounded-xl',
     textSize: 'text-sm',
     spacing: 'gap-2 mb-3', // Plus dense
     animations: false, // Moins d'animations pour focus
     showMetadata: true,
     maxWidth: 'max-w-[80%]'
   }
 };

 const config = ageConfig[mode];

 // Lecture automatique des réponses de l'IA (si activé)
 // Ne lit que les nouveaux messages, pas les anciens quand on active autoSpeak
 useEffect(() => {
 if (
 autoSpeak &&
 enableVoice &&
 audio.isSupported &&
 !isUser &&
 message.status === 'complete' &&
 message.content &&
 !hasBeenSpokenRef.current // ✅ Ne lit que si pas encore lu
 ) {
 // Délai court pour laisser le temps à l'animation d'apparaître
 const timer = setTimeout(() => {
 void audio.speakMessage(message.id, message.content);
 hasBeenSpokenRef.current = true; // ✅ Marquer comme lu
 }, 500);

 return () => clearTimeout(timer);
 }
 // Pas de cleanup si les conditions ne sont pas remplies
 return undefined;
 }, [autoSpeak, enableVoice, audio, isUser, message.status, message.content, message.id]);

 return (
 <div className={cn(
          "flex gap-2 mb-1",
          isUser ? "justify-end" : "justify-start"
        )}>
        <div className={cn(
          "flex gap-2 max-w-[85%] md:max-w-[75%]",
          isUser ? "flex-row-reverse" : "flex-row"
        )}>
 {/* Avatar simplifié et moderne */}
 <div className="shrink-0">
 <Avatar className={cn(
            "w-8 h-8 shadow-sm",
            isUser
              ? "bg-primary ring-2 ring-primary/20"
              : "bg-gradient-to-br from-muted to-muted/90 ring-2 ring-muted/20"
          )}>
          <AvatarFallback className={cn(
            "text-xs font-semibold",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-gradient-to-br from-muted to-muted/90 text-foreground"
          )}>
 {isUser ? (
 <User className="w-4 h-4" />
 ) : (
 <Brain className="w-4 h-4" />
 )}
 </AvatarFallback>
 </Avatar>
 </div>

 {/* Contenu du message avec design moderne WhatsApp/Telegram style */}
 <div className="flex flex-col gap-1 min-w-0 flex-1">
 <motion.div
 initial={{ scale: 0.97, opacity: 0 }}
 animate={{ scale: 1, opacity: 1 }}
 transition={{ duration: 0.2, ease: "easeOut" }}
 className={cn(
            "px-2.5 py-1.5 shadow-sm",
            isUser
              ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm"
              : "bg-muted/80 text-foreground rounded-2xl rounded-tl-sm backdrop-blur-sm"
          )}
 >
 <div className="break-words overflow-hidden">
 {message.status === 'typing' ? (
 <div className="flex items-center gap-1">
 <span className="text-muted-foreground text-sm">TomIA réfléchit</span>
 <div className="flex gap-1">
 <motion.div
 animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
 transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
 className="w-1.5 h-1.5 bg-current rounded-full"
 />
 <motion.div
 animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
 transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
 className="w-1.5 h-1.5 bg-current rounded-full"
 />
 <motion.div
 animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
 transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
 className="w-1.5 h-1.5 bg-current rounded-full"
 />
 </div>
 </div>
 ) : (
 <div className={cn(config.textSize, "leading-tight")}>
 {isUser ? (
 // Messages utilisateur - texte simple + fichier attaché
 <>
 <span>{message.content ?? 'Message vide'}</span>
 <AttachedFileDisplay attachedFile={message.attachedFile} />
 </>
 ) : (
 // Messages IA - Markdown optimisé avec espacement compact
 <div className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
 <ReactMarkdown
 remarkPlugins={[remarkMath]}
 rehypePlugins={[rehypeKatex]}
 components={{
 p: ({children}) => <p className="my-2 first:mt-0 last:mb-0 leading-relaxed">{children}</p>,
 ul: ({children}) => <ul className="list-disc ml-4 my-2 first:mt-0 last:mb-0 space-y-0.5">{children}</ul>,
 ol: ({children}) => <ol className="list-decimal ml-4 my-2 first:mt-0 last:mb-0 space-y-0.5">{children}</ol>,
 li: ({children}) => <li className="leading-relaxed">{children}</li>,
 h1: ({children}) => <h1 className="text-base font-semibold my-2 first:mt-0">{children}</h1>,
 h2: ({children}) => <h2 className="text-base font-semibold my-2 first:mt-0">{children}</h2>,
 h3: ({children}) => <h3 className="text-sm font-semibold my-1.5 first:mt-0">{children}</h3>,
 blockquote: ({children}) => <blockquote className="border-l-2 border-border pl-2.5 my-2 italic bg-muted/20 py-1.5 rounded-r">{children}</blockquote>,
 hr: () => <hr className="my-2 border-border" />,
 code: ({className, children, ...props}) => {
 const isInline = !className;
 return isInline ? (
 <code className="bg-muted px-1 py-0.5 rounded text-xs" {...props}>
 {children}
 </code>
 ) : (
 <pre className="bg-muted p-2 rounded text-xs overflow-x-auto my-2 border border-border">
 <code className={className} {...props}>{children}</code>
 </pre>
 );
 },
 }}
 >
 {typeof message.content === 'string' ? message.content : (message.content ? JSON.stringify(message.content) : 'Message vide')}
 </ReactMarkdown>
 {message.isPartial && (
 <span className="inline-block w-1.5 h-3.5 bg-current opacity-75 animate-pulse ml-0.5" />
 )}
 </div>
 )}
 </div>
 )}
 </div>
 </motion.div>

 {/* Affichage du fichier attaché */}
 {message.attachedFile && <AttachedFileDisplay attachedFile={message.attachedFile} />}

 {/* Métadonnées compactes en dessous */}
 <div className={cn(
            "flex items-center gap-1.5 px-1 text-[11px]",
            isUser ? "justify-end" : "justify-start"
          )}>
 <span className="text-muted-foreground/70">
 {new Date(message.timestamp).toLocaleTimeString('fr-FR', {
 hour: '2-digit',
 minute: '2-digit'
 })}
 </span>

 {/* Bouton lecture vocale minimaliste */}
 {enableVoice && audio.isSupported && message.content && message.status === 'complete' && (
 <button
 onClick={() => {
 if (audio.state.currentlySpeaking && audio.state.activeMessageId === message.id) {
 audio.stopSpeaking();
 } else {
 void audio.speakMessage(message.id, message.content);
 }
 }}
 className={cn(
              "p-1 rounded-md transition-colors",
              audio.state.currentlySpeaking && audio.state.activeMessageId === message.id
                ? "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/30"
            )}
 title={audio.state.currentlySpeaking && audio.state.activeMessageId === message.id ? 'Arrêter' : 'Lire'}
 >
 {audio.state.currentlySpeaking && audio.state.activeMessageId === message.id ? (
 <VolumeX className="w-3 h-3" />
 ) : (
 <Volume2 className="w-3 h-3" />
 )}
 </button>
 )}

 {!isUser && providerInfo && (
 <AIModelBadge
 model={providerInfo.name}
 isFallback={false}
 />
 )}
 </div>

 {!isUser && <FrustrationTip metadata={message.metadata} />}
 </div>
 </div>
 </div>
 );
}

export default MessageBubble;
