/**
 * MessageAttachment - Affichage fichier attaché dans message chat
 *
 * Affiche un apercu du fichier (image preview ou icône) avec nom et taille.
 * Utilisé dans les messages user pour montrer les fichiers envoyés.
 * Optionnellement permet la suppression via onRemove callback.
 */

import { type ReactElement } from 'react';
import { FileText, FileImage, File as FileIcon, Mic, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { IChatFileAttachment } from '@/types';

export interface MessageAttachmentProps {
  attachment: IChatFileAttachment;
  /** Callback pour supprimer le fichier (optionnel) */
  onRemove?: (fileId: string) => void;
  className?: string;
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes === 0) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileIcon(mimeType: string): ReactElement {
  if (mimeType.startsWith('image/')) {
    return <FileImage className="h-4 w-4 text-blue-500" />;
  } else if (mimeType === 'application/pdf') {
    return <FileText className="h-4 w-4 text-red-500" />;
  } else if (mimeType.startsWith('audio/')) {
    return <Mic className="h-4 w-4 text-purple-500" />;
  }
  return <FileIcon className="h-4 w-4 text-muted-foreground" />;
}

export function MessageAttachment({
  attachment,
  onRemove,
  className
}: MessageAttachmentProps): ReactElement {
  const { fileId, fileName, mimeType, size, preview } = attachment;
  const isImage = mimeType.startsWith('image/');

  return (
    <div
      className={cn(
        'group relative flex items-center gap-2 p-2 rounded-md',
        'bg-background/50 border border-border/50',
        'max-w-[200px]',
        className
      )}
    >
      {/* Preview ou icône */}
      <div className="flex-shrink-0">
        {isImage && preview ? (
          <img
            src={preview}
            alt={fileName}
            className="h-10 w-10 rounded object-cover"
          />
        ) : (
          <div className="h-10 w-10 rounded bg-muted/50 flex items-center justify-center">
            {getFileIcon(mimeType)}
          </div>
        )}
      </div>

      {/* Info fichier */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <p className="text-xs font-medium truncate" title={fileName}>
          {fileName}
        </p>
        {size && (
          <p className="text-[10px] text-muted-foreground">
            {formatFileSize(size)}
          </p>
        )}
      </div>

      {/* Bouton suppression (visible au hover) */}
      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRemove(fileId)}
          className={cn(
            'absolute -top-2 -right-2 h-5 w-5 rounded-full',
            'bg-destructive text-destructive-foreground',
            'opacity-0 group-hover:opacity-100 transition-opacity',
            'hover:bg-destructive/90'
          )}
          title="Supprimer le fichier"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
