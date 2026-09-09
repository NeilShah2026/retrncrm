/** @type {import('tailwindcss').Config} */
/*
 * Tailwind is a thin mapping over the CSS variables in src/index.css. Add a
 * token there first; expose it here second. Never hard-code a hue in a
 * component class (no `indigo-500`, no `violet-*`) — see DESIGN.md.
 */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      fontFamily: {
        // One grotesque for marketing, app chrome, and body. Geist is loaded
        // in index.html; the system stack is the fallback ladder.
        sans: [
          'Geist',
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
          'Apple Color Emoji',
          'Segoe UI Emoji',
        ],
        mono: [
          'Geist Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Consolas',
          'monospace',
        ],
      },
      // Type scale: caption 11 · UI 13 · body 14 · section 16 · title 20 · page 24.
      fontSize: {
        xs: ['11px', { lineHeight: '16px' }],
        sm: ['13px', { lineHeight: '20px' }],
        base: ['14px', { lineHeight: '22px' }],
        lg: ['16px', { lineHeight: '24px' }],
        xl: ['18px', { lineHeight: '26px' }],
        '2xl': ['22px', { lineHeight: '28px', letterSpacing: '-0.015em' }],
        '3xl': ['28px', { lineHeight: '34px', letterSpacing: '-0.02em' }],
      },
      colors: {
        // ---- Semantic ------------------------------------------------
        bg: {
          DEFAULT: 'hsl(var(--bg))',
          elevated: 'hsl(var(--bg-elevated))',
          sunken: 'hsl(var(--bg-sunken))',
        },
        border: {
          DEFAULT: 'hsl(var(--border))',
          subtle: 'hsl(var(--border-subtle))',
          strong: 'hsl(var(--border-strong))',
        },
        text: {
          DEFAULT: 'hsl(var(--text))',
          secondary: 'hsl(var(--text-secondary))',
          muted: 'hsl(var(--text-muted))',
        },
        brand: {
          DEFAULT: 'hsl(var(--brand))',
          hover: 'hsl(var(--brand-hover))',
          foreground: 'hsl(var(--on-brand))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          soft: 'hsl(var(--success-soft))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          soft: 'hsl(var(--warning-soft))',
        },
        danger: {
          DEFAULT: 'hsl(var(--danger))',
          soft: 'hsl(var(--danger-soft))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          soft: 'hsl(var(--info-soft))',
        },

        // ---- shadcn component aliases --------------------------------
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          hover: 'hsl(var(--primary-hover))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      // Radius roles: control 6 · card/panel 8 · modal 10. `rounded-xl` and
      // up are intentionally NOT mapped to tokens — reach for them only for
      // true pills (`rounded-full`) or the phone's bottom sheet.
      borderRadius: {
        lg: 'var(--radius)',
        md: 'var(--radius-control)',
        sm: '4px',
        modal: 'var(--radius-modal)',
      },
      boxShadow: {
        // Only floating layers (popover, menu, dialog, ⌘K) get a shadow.
        popover:
          '0 0 0 1px hsl(var(--border)), 0 4px 12px -2px rgb(0 0 0 / 0.08), 0 2px 4px -1px rgb(0 0 0 / 0.04)',
        modal:
          '0 0 0 1px hsl(var(--border)), 0 16px 40px -12px rgb(0 0 0 / 0.25), 0 4px 12px -4px rgb(0 0 0 / 0.1)',
      },
      transitionDuration: {
        fast: 'var(--duration-fast)',
        DEFAULT: 'var(--duration-base)',
      },
      transitionTimingFunction: {
        DEFAULT: 'var(--ease-out)',
        out: 'var(--ease-out)',
        'in-out': 'var(--ease-in-out)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 160ms var(--ease-out)',
        'accordion-up': 'accordion-up 160ms var(--ease-out)',
        'fade-in': 'fade-in 160ms var(--ease-out)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
