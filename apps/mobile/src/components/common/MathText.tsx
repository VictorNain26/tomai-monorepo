/**
 * MathText Component
 *
 * Renders text with inline and block LaTeX math formulas using KaTeX.
 * Supports both inline ($...$) and block ($$...$$) math.
 *
 * Best Practice 2026: WebView-based KaTeX for maximum compatibility
 * with React Native 0.81+ and Expo SDK 54.
 */

import { useState, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { Text } from '@/components/ui/text';
import { useThemeColors } from '@/hooks/useThemeColors';

// ============================================================================
// TYPES
// ============================================================================

interface MathTextProps {
  /** Text content with optional LaTeX formulas */
  children: string;
  /** Additional className for styling */
  className?: string;
  /** Text color override (default: auto based on theme) */
  textColor?: string;
  /** Font size in pixels (default: 16) */
  fontSize?: number;
}

interface ParsedSegment {
  type: 'text' | 'inline-math' | 'block-math';
  content: string;
}

// ============================================================================
// MATH DETECTION
// ============================================================================

/**
 * Check if text contains any LaTeX math expressions
 */
export function containsMath(text: string): boolean {
  // Block math: $$...$$
  if (/\$\$[\s\S]+?\$\$/.test(text)) return true;
  // Inline math: $...$ (not $$)
  if (/(?<!\$)\$(?!\$).+?(?<!\$)\$(?!\$)/.test(text)) return true;
  // LaTeX commands
  if (/\\(frac|sqrt|int|sum|prod|lim|sin|cos|tan|log|ln|exp|alpha|beta|gamma|delta|pi|theta|omega|infty|partial|nabla|vec|hat|bar|dot|ddot)\b/.test(text)) return true;
  return false;
}

/**
 * Parse text into segments of plain text and math
 */
function parseContent(text: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  const mathRegex = /(\$\$[\s\S]+?\$\$)|(\$[^$\n]+?\$)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mathRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const textBefore = text.slice(lastIndex, match.index);
      if (textBefore.trim()) {
        segments.push({ type: 'text', content: textBefore });
      }
    }

    const fullMatch = match[0];
    if (fullMatch.startsWith('$$') && fullMatch.endsWith('$$')) {
      segments.push({
        type: 'block-math',
        content: fullMatch.slice(2, -2).trim(),
      });
    } else {
      segments.push({
        type: 'inline-math',
        content: fullMatch.slice(1, -1).trim(),
      });
    }

    lastIndex = match.index + fullMatch.length;
  }

  if (lastIndex < text.length) {
    const textAfter = text.slice(lastIndex);
    if (textAfter.trim()) {
      segments.push({ type: 'text', content: textAfter });
    }
  }

  if (segments.length === 0) {
    segments.push({ type: 'text', content: text });
  }

  return segments;
}

// ============================================================================
// KATEX HTML GENERATOR
// ============================================================================

function generateKaTeXHtml(
  latex: string,
  displayMode: boolean,
  textColor: string,
  fontSize: number
): string {
  const escapedLatex = latex
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const jsLatex = escapedLatex
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { background: transparent; overflow: hidden; font-size: ${fontSize}px; }
    #math {
      color: ${textColor};
      font-size: ${fontSize}px;
      line-height: 1.5;
      ${displayMode ? 'text-align: center; padding: 8px 0;' : 'display: inline;'}
    }
    .katex { font-size: 1em !important; }
    .katex-error { color: #dc2626; font-size: 12px; }
  </style>
</head>
<body>
  <div id="math"></div>
  <script>
    try {
      katex.render("${jsLatex}", document.getElementById("math"), {
        displayMode: ${displayMode},
        throwOnError: false,
        errorColor: '#dc2626',
        trust: false,
        strict: false,
        macros: {
          "\\\\R": "\\\\mathbb{R}",
          "\\\\N": "\\\\mathbb{N}",
          "\\\\Z": "\\\\mathbb{Z}",
          "\\\\Q": "\\\\mathbb{Q}",
          "\\\\C": "\\\\mathbb{C}"
        }
      });
      setTimeout(function() {
        var height = document.body.scrollHeight;
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ height: height }));
        }
      }, 100);
    } catch (e) {
      document.getElementById("math").innerHTML = '<span class="katex-error">Erreur: ' + e.message + '</span>';
    }
  </script>
</body>
</html>`;
}

// ============================================================================
// MATH WEBVIEW COMPONENT
// ============================================================================

interface MathWebViewProps {
  latex: string;
  displayMode: boolean;
  textColor: string;
  fontSize: number;
}

function MathWebView({ latex, displayMode, textColor, fontSize }: MathWebViewProps) {
  const [height, setHeight] = useState(displayMode ? 60 : 24);

  const html = useMemo(
    () => generateKaTeXHtml(latex, displayMode, textColor, fontSize),
    [latex, displayMode, textColor, fontSize]
  );

  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as { height?: number };
      if (data.height && data.height > 0) {
        setHeight(Math.ceil(data.height) + 4);
      }
    } catch {
      // Ignore parse errors
    }
  };

  return (
    <WebView
      source={{ html }}
      style={[
        styles.webview,
        { height },
        displayMode ? styles.blockMath : styles.inlineMath,
      ]}
      scrollEnabled={false}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      onMessage={handleMessage}
      originWhitelist={['*']}
      javaScriptEnabled
      domStorageEnabled={false}
      cacheEnabled
      androidLayerType="hardware"
    />
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function MathText({
  children,
  className,
  textColor,
  fontSize = 16,
}: MathTextProps) {
  const themeColors = useThemeColors();
  const resolvedTextColor = textColor ?? themeColors.foreground;

  const segments = useMemo(() => parseContent(children), [children]);

  const hasMath = segments.some(
    (s) => s.type === 'inline-math' || s.type === 'block-math'
  );

  // If no math, render as plain text for performance
  if (!hasMath) {
    return (
      <Text className={className} style={{ fontSize }}>
        {children}
      </Text>
    );
  }

  return (
    <View style={styles.container} className={className}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return (
            <Text
              key={`text-${index}`}
              style={[styles.text, { fontSize, color: resolvedTextColor }]}
            >
              {segment.content}
            </Text>
          );
        }

        if (segment.type === 'inline-math') {
          return (
            <View key={`inline-${index}`} style={styles.inlineMathWrapper}>
              <MathWebView
                latex={segment.content}
                displayMode={false}
                textColor={resolvedTextColor}
                fontSize={fontSize}
              />
            </View>
          );
        }

        if (segment.type === 'block-math') {
          return (
            <View key={`block-${index}`} style={styles.blockMathWrapper}>
              <MathWebView
                latex={segment.content}
                displayMode
                textColor={resolvedTextColor}
                fontSize={fontSize}
              />
            </View>
          );
        }

        return null;
      })}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  text: {
    lineHeight: 24,
  },
  webview: {
    backgroundColor: 'transparent',
  },
  inlineMath: {
    minWidth: 20,
    maxWidth: 300,
  },
  blockMath: {
    minWidth: 200,
  },
  inlineMathWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  blockMathWrapper: {
    width: '100%',
    marginVertical: 8,
  },
});

export default MathText;
