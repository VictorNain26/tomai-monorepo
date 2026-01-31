/**
 * TomAvatar Component - TomAI 2026
 *
 * Avatar/mascot for Tom the AI tutor.
 * Currently uses a placeholder - replace with actual asset when ready.
 *
 * Usage:
 *   <TomAvatar size="sm" />  // 32px - chat messages
 *   <TomAvatar size="md" />  // 48px - cards, headers
 *   <TomAvatar size="lg" />  // 80px - welcome screens, auth
 */

import { View, Image } from 'react-native';
import { Text } from '@/components/ui/text';
import { bgColors } from '@/lib/styles';

// =============================================================================
// CONFIGURATION
// =============================================================================

// TODO: Replace with actual Tom avatar asset
// import TomImage from '@/assets/images/tom-avatar.png';
const TOM_IMAGE_URL: string | null = null;

const SIZES = {
  sm: {
    container: 32,
    emoji: 'text-base',
    image: 28,
  },
  md: {
    container: 48,
    emoji: 'text-2xl',
    image: 40,
  },
  lg: {
    container: 80,
    emoji: 'text-4xl',
    image: 64,
  },
} as const;

// =============================================================================
// TYPES
// =============================================================================

interface TomAvatarProps {
  size?: keyof typeof SIZES;
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function TomAvatar({ size = 'md', className }: TomAvatarProps) {
  const sizeConfig = SIZES[size];

  return (
    <View
      className={`items-center justify-center rounded-full ${className ?? ''}`}
      style={{
        width: sizeConfig.container,
        height: sizeConfig.container,
        backgroundColor: bgColors.primary[15],
      }}
    >
      {TOM_IMAGE_URL ? (
        <Image
          source={{ uri: TOM_IMAGE_URL }}
          style={{
            width: sizeConfig.image,
            height: sizeConfig.image,
            borderRadius: sizeConfig.image / 2,
          }}
          resizeMode="contain"
        />
      ) : (
        // Placeholder until actual asset is ready
        <Text className={sizeConfig.emoji}>✨</Text>
      )}
    </View>
  );
}
