/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      /**
       * TomAI Design System - 2026
       *
       * Palette sobre et professionnelle.
       * Variables CSS définies dans src/global.css
       */
      colors: {
        // Core semantic colors
        primary: {
          DEFAULT: 'hsl(var(--color-primary))',
          foreground: 'hsl(var(--color-primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--color-secondary))',
          foreground: 'hsl(var(--color-secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--color-destructive))',
          foreground: 'hsl(var(--color-destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--color-muted))',
          foreground: 'hsl(var(--color-muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--color-accent))',
          foreground: 'hsl(var(--color-accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--color-popover))',
          foreground: 'hsl(var(--color-popover-foreground))',
        },

        // Status colors
        success: {
          DEFAULT: 'hsl(var(--color-success))',
          foreground: 'hsl(var(--color-success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--color-warning))',
          foreground: 'hsl(var(--color-warning-foreground))',
        },
        info: {
          DEFAULT: 'hsl(var(--color-info))',
          foreground: 'hsl(var(--color-info-foreground))',
        },

        // Layout colors
        border: 'hsl(var(--color-border))',
        input: 'hsl(var(--color-input))',
        ring: 'hsl(var(--color-ring))',
        background: 'hsl(var(--color-background))',
        foreground: 'hsl(var(--color-foreground))',
        card: {
          DEFAULT: 'hsl(var(--color-card))',
          foreground: 'hsl(var(--color-card-foreground))',
        },
      },

      /**
       * Border Radius
       * Modern but not excessive - professional look
       */
      borderRadius: {
        '2xl': 16,  // Large cards, modals
        xl: 14,     // Cards, buttons large
        lg: 12,     // Default cards
        md: 10,     // Buttons, inputs
        sm: 8,      // Small elements
        xs: 6,      // Badges, tags
      },

      /**
       * Spacing additions
       * Consistent spacing scale
       */
      spacing: {
        18: '4.5rem',   // 72px
        22: '5.5rem',   // 88px
      },

      /**
       * Font sizes optimized for mobile education
       */
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],  // 10px - badges
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
