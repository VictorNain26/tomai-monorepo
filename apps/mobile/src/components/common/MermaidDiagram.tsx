/**
 * MermaidDiagram Component
 *
 * Renders Mermaid.js diagrams using a WebView.
 * Supports flowcharts, sequence diagrams, class diagrams, etc.
 *
 * Best Practice 2026: WebView-based Mermaid for maximum compatibility
 * with React Native 0.81+ and Expo SDK 54.
 *
 * Security Note: The WebView is sandboxed and Mermaid's securityLevel
 * is set to 'strict'. The SVG output from mermaid.render() is safe.
 */

import { useState, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/useTheme';
import { useThemeColors, type ThemeColors } from '@/hooks/useThemeColors';

// ============================================================================
// TYPES
// ============================================================================

interface MermaidDiagramProps {
  /** Mermaid diagram code */
  chart: string;
  /** Additional className for styling */
  className?: string;
}

// ============================================================================
// MERMAID DETECTION
// ============================================================================

/**
 * Check if text contains a Mermaid code block
 */
export function containsMermaid(text: string): boolean {
  return /```mermaid[\s\S]*?```/.test(text);
}

/**
 * Extract Mermaid code from markdown code block
 */
export function extractMermaidCode(text: string): string {
  const match = text.match(/```mermaid\s*([\s\S]*?)\s*```/);
  return match?.[1]?.trim() ?? '';
}

// ============================================================================
// HTML GENERATOR
// ============================================================================

function generateMermaidHtml(chart: string, isDark: boolean, tc: ThemeColors): string {
  const escapedChart = chart
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');

  const bgColor = tc.background;
  const textColor = tc.foreground;

  const themeVars = isDark
    ? `{
        primaryColor: '${tc.primary}',
        primaryTextColor: '${tc.foreground}',
        primaryBorderColor: '${tc.primary}',
        lineColor: '${tc.border}',
        secondaryColor: '${tc.success}',
        tertiaryColor: '#a855f7',
        background: '${tc.background}',
        mainBkg: '#1E293B',
        textColor: '${tc.foreground}',
        nodeBorder: '${tc.primary}',
        clusterBkg: '#1E293B',
        clusterBorder: '${tc.border}',
        edgeLabelBackground: '#1E293B'
      }`
    : `{
        primaryColor: '${tc.primary}',
        primaryTextColor: '#FFFFFF',
        primaryBorderColor: '${tc.primary}',
        lineColor: '#9ca3af',
        secondaryColor: '${tc.success}',
        tertiaryColor: '#a855f7',
        background: '#ffffff',
        mainBkg: '${tc.background}',
        textColor: '${tc.foreground}',
        nodeBorder: '${tc.primary}',
        clusterBkg: '${tc.background}',
        clusterBorder: '${tc.border}',
        edgeLabelBackground: '#ffffff'
      }`;

  const themeName = isDark ? 'dark' : 'default';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      background: ${bgColor};
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    #container { padding: 16px; min-height: 100px; }
    #diagram { display: flex; justify-content: center; align-items: center; }
    #diagram svg { max-width: 100%; height: auto; }
    .error-box {
      color: #dc2626;
      font-size: 12px;
      padding: 8px;
      background: rgba(220, 38, 38, 0.1);
      border: 1px solid rgba(220, 38, 38, 0.3);
      border-radius: 4px;
    }
    .error-box pre {
      margin-top: 8px;
      font-size: 10px;
      white-space: pre-wrap;
      word-break: break-all;
      color: ${textColor};
      opacity: 0.7;
    }
    .loading-text {
      color: ${textColor};
      opacity: 0.5;
      font-size: 14px;
      text-align: center;
      padding: 20px;
    }
  </style>
</head>
<body>
  <div id="container">
    <div id="diagram" class="loading-text">Chargement du diagramme...</div>
  </div>
  <script>
    var chartCode = \`${escapedChart}\`;

    mermaid.initialize({
      startOnLoad: false,
      theme: '${themeName}',
      themeVariables: ${themeVars},
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      securityLevel: 'strict',
      flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
      sequence: { useMaxWidth: true, diagramMarginX: 8, diagramMarginY: 8 }
    });

    (async function() {
      var container = document.getElementById('diagram');
      try {
        var id = 'diagram-' + Math.random().toString(36).substr(2, 9);
        var result = await mermaid.render(id, chartCode);
        container.className = '';
        container.textContent = '';
        var wrapper = document.createElement('div');
        wrapper.innerHTML = result.svg;
        container.appendChild(wrapper.firstChild);

        setTimeout(function() {
          var h = document.body.scrollHeight;
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', height: h }));
          }
        }, 100);
      } catch (err) {
        container.className = 'error-box';
        container.textContent = 'Erreur de rendu: ' + (err.message || 'Syntaxe invalide');
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: err.message }));
        }
      }
    })();
  </script>
</body>
</html>`;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function MermaidDiagram({ chart, className }: MermaidDiagramProps) {
  const { isDark } = useTheme();
  const tc = useThemeColors();
  const [height, setHeight] = useState(200);
  const [error, setError] = useState<string | null>(null);

  const html = useMemo(
    () => generateMermaidHtml(chart, isDark, tc),
    [chart, isDark, tc]
  );

  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as {
        type: string;
        height?: number;
        message?: string;
      };

      if (data.type === 'height' && data.height && data.height > 0) {
        setHeight(Math.ceil(data.height) + 16);
      } else if (data.type === 'error' && data.message) {
        setError(data.message);
      }
    } catch {
      // Ignore parse errors
    }
  };

  if (error) {
    return (
      <View style={styles.errorContainer} className={className}>
        <Text className="text-sm font-semibold text-red-600 dark:text-red-400">
          Erreur de diagramme
        </Text>
        <Text className="mt-1 text-xs text-slate-500 dark:text-slate-400">{error}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { borderColor: tc.border }]} className={className}>
      <WebView
        source={{ html }}
        style={[styles.webview, { height }]}
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
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
  },
  webview: {
    backgroundColor: 'transparent',
    minHeight: 100,
  },
  errorContainer: {
    marginVertical: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
  },
});

export default MermaidDiagram;
