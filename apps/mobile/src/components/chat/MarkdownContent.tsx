/**
 * MarkdownContent Component - TomAI 2026
 *
 * Renders markdown text with proper formatting for chat messages.
 * Handles bold, italic, code, lists, headers, etc.
 * Theme-aware (light/dark mode).
 */

import { useMemo } from 'react';
import { Platform, useColorScheme } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { colors } from '@/lib/styles';

// ============================================================================
// TYPES
// ============================================================================

interface MarkdownContentProps {
  children: string;
  /** Whether this is a user message (white text on primary bg) */
  isUser?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MarkdownContent({ children, isUser = false }: MarkdownContentProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const textColor = isUser
    ? colors.primary.foreground
    : isDark
      ? colors.foreground.dark
      : colors.foreground.light;

  const mutedColor = isUser
    ? 'rgba(248, 250, 252, 0.7)'
    : isDark
      ? colors.muted.foregroundDark
      : colors.muted.foreground;

  const codeBg = isUser
    ? 'rgba(255, 255, 255, 0.15)'
    : isDark
      ? 'rgba(255, 255, 255, 0.1)'
      : 'rgba(0, 0, 0, 0.05)';

  const codeBorder = isUser
    ? 'rgba(255, 255, 255, 0.2)'
    : isDark
      ? 'rgba(255, 255, 255, 0.15)'
      : 'rgba(0, 0, 0, 0.1)';

  const blockquoteBorder = isUser
    ? 'rgba(255, 255, 255, 0.3)'
    : colors.primary.DEFAULT;

  const blockquoteBg = isUser
    ? 'rgba(255, 255, 255, 0.1)'
    : isDark
      ? 'rgba(37, 99, 235, 0.1)'
      : 'rgba(37, 99, 235, 0.05)';

  const mdStyles = useMemo(
    () => ({
      body: {
        color: textColor,
        fontSize: 16,
        lineHeight: 24,
      },
      paragraph: {
        marginTop: 0,
        marginBottom: 8,
        flexWrap: 'wrap' as const,
        flexDirection: 'row' as const,
        alignItems: 'flex-start' as const,
        justifyContent: 'flex-start' as const,
        width: '100%' as const,
      },
      strong: {
        fontWeight: '700' as const,
        color: textColor,
      },
      em: {
        fontStyle: 'italic' as const,
        color: textColor,
      },
      heading1: {
        fontSize: 22,
        fontWeight: '700' as const,
        color: textColor,
        marginTop: 12,
        marginBottom: 6,
        flexDirection: 'row' as const,
      },
      heading2: {
        fontSize: 20,
        fontWeight: '700' as const,
        color: textColor,
        marginTop: 10,
        marginBottom: 4,
        flexDirection: 'row' as const,
      },
      heading3: {
        fontSize: 18,
        fontWeight: '600' as const,
        color: textColor,
        marginTop: 8,
        marginBottom: 4,
        flexDirection: 'row' as const,
      },
      heading4: {
        fontSize: 16,
        fontWeight: '600' as const,
        color: textColor,
        marginTop: 6,
        marginBottom: 2,
        flexDirection: 'row' as const,
      },
      code_inline: {
        backgroundColor: codeBg,
        borderColor: codeBorder,
        borderWidth: 1,
        borderRadius: 4,
        paddingHorizontal: 4,
        paddingVertical: 1,
        color: textColor,
        fontSize: 14,
        ...Platform.select({
          ios: { fontFamily: 'Menlo' },
          android: { fontFamily: 'monospace' },
        }),
      },
      code_block: {
        backgroundColor: codeBg,
        borderColor: codeBorder,
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        color: textColor,
        fontSize: 13,
        lineHeight: 20,
        ...Platform.select({
          ios: { fontFamily: 'Menlo' },
          android: { fontFamily: 'monospace' },
        }),
      },
      fence: {
        backgroundColor: codeBg,
        borderColor: codeBorder,
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        color: textColor,
        fontSize: 13,
        lineHeight: 20,
        ...Platform.select({
          ios: { fontFamily: 'Menlo' },
          android: { fontFamily: 'monospace' },
        }),
      },
      blockquote: {
        backgroundColor: blockquoteBg,
        borderLeftWidth: 3,
        borderColor: blockquoteBorder,
        paddingHorizontal: 12,
        paddingVertical: 4,
        marginVertical: 4,
      },
      bullet_list: {
        marginVertical: 4,
      },
      ordered_list: {
        marginVertical: 4,
      },
      list_item: {
        flexDirection: 'row' as const,
        justifyContent: 'flex-start' as const,
        marginVertical: 2,
      },
      bullet_list_icon: {
        marginLeft: 4,
        marginRight: 8,
        color: mutedColor,
      },
      bullet_list_content: {
        flex: 1,
      },
      ordered_list_icon: {
        marginLeft: 4,
        marginRight: 8,
        color: mutedColor,
      },
      ordered_list_content: {
        flex: 1,
      },
      link: {
        color: isUser ? '#93C5FD' : colors.primary.DEFAULT,
        textDecorationLine: 'underline' as const,
      },
      hr: {
        backgroundColor: codeBorder,
        height: 1,
        marginVertical: 8,
      },
      table: {
        borderWidth: 1,
        borderColor: codeBorder,
        borderRadius: 6,
        marginVertical: 4,
      },
      tr: {
        borderBottomWidth: 1,
        borderColor: codeBorder,
        flexDirection: 'row' as const,
      },
      th: {
        flex: 1,
        padding: 6,
        fontWeight: '600' as const,
      },
      td: {
        flex: 1,
        padding: 6,
      },
      text: {
        color: textColor,
      },
      textgroup: {},
      s: {
        textDecorationLine: 'line-through' as const,
      },
    }),
    [textColor, mutedColor, codeBg, codeBorder, blockquoteBg, blockquoteBorder, isUser]
  );

  return (
    <Markdown style={mdStyles}>
      {children}
    </Markdown>
  );
}
