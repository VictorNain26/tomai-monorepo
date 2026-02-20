/**
 * FileAttachmentCard Component
 *
 * Displays a file attachment in chat messages with download/share buttons.
 */

import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { FileText, Image, File, Share2, Music } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { useFileShare, useIconColors } from '@/hooks';
import { bgColors } from '@/lib/styles';

// ============================================================================
// TYPES
// ============================================================================

interface FileAttachmentCardProps {
  fileId: string;
  fileName: string;
  mimeType?: string;
  fileSizeBytes?: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function FileAttachmentCard({
  fileId,
  fileName,
  mimeType,
  fileSizeBytes,
}: FileAttachmentCardProps) {
  const iconColors = useIconColors();
  const fileShare = useFileShare();

  const iconColor = iconColors.foreground;

  const handleDownloadAndShare = async () => {
    await fileShare.downloadAndShare(fileId, fileName, mimeType);
  };

  const fileSize = fileSizeBytes ? formatFileSize(fileSizeBytes) : null;
  const isLoading = fileShare.isDownloading || fileShare.isSharing;

  return (
    <View className="mt-2 flex-row items-center gap-3 rounded-lg border border-border bg-card p-3">
      {/* File Icon */}
      <View className="h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: bgColors.primary[10] }}>
        <FileIconView mimeType={mimeType} color={iconColor} size={20} />
      </View>

      {/* File Info */}
      <View className="flex-1">
        <Text className="text-sm font-medium" numberOfLines={1}>
          {fileName}
        </Text>
        {fileSize && (
          <Text variant="muted" className="text-xs">
            {fileSize}
          </Text>
        )}
      </View>

      {/* Download/Share Button */}
      <TouchableOpacity
        onPress={handleDownloadAndShare}
        disabled={isLoading}
        className="flex-row items-center gap-1 rounded-lg px-3 py-2"
        style={{ backgroundColor: bgColors.primary[10] }}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : (
          <>
            <Share2 color={iconColor} size={16} />
            <Text className="text-xs font-medium">Partager</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

interface FileIconViewProps {
  mimeType?: string;
  color: string;
  size: number;
}

function FileIconView({ mimeType, color, size }: FileIconViewProps) {
  if (!mimeType) return <File color={color} size={size} />;
  if (mimeType.startsWith('image/')) return <Image color={color} size={size} />;
  if (mimeType.startsWith('audio/')) return <Music color={color} size={size} />;
  if (mimeType === 'application/pdf') return <FileText color={color} size={size} />;
  if (
    mimeType.includes('word') ||
    mimeType.includes('document') ||
    mimeType === 'text/plain'
  ) {
    return <FileText color={color} size={size} />;
  }
  return <File color={color} size={size} />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default FileAttachmentCard;
