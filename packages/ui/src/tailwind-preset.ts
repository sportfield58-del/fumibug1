import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'
import animate from 'tailwindcss-animate'

/**
 * Fumibug Tailwind Preset
 * Consume tokens.css como fuente única de verdad.
 * Usar en apps/web:  extend: [require('@fumibug/ui/tailwind-preset')]
 *
 * Spec: docs/spec/07-uxui.md §G.1
 */

const fumibugPreset = {
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: 'var(--bg)',
          elevated: 'var(--bg-elevated)',
          sunken: 'var(--bg-sunken)',
        },
        border: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
        },
        fg: {
          DEFAULT: 'var(--fg)',
          muted: 'var(--fg-muted)',
          subtle: 'var(--fg-subtle)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
          fg: 'var(--primary-fg)',
          subtle: 'var(--primary-subtle)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          hover: 'var(--destructive-hover)',
          fg: 'var(--destructive-fg)',
        },
        success: {
          DEFAULT: 'var(--success)',
          subtle: 'var(--success-subtle)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          subtle: 'var(--warning-subtle)',
        },
        info: {
          DEFAULT: 'var(--info)',
          subtle: 'var(--info-subtle)',
        },
        disabled: {
          bg: 'var(--disabled-bg)',
          fg: 'var(--disabled-fg)',
        },
        state: {
          draft: 'var(--state-draft)',
          scheduled: 'var(--state-scheduled)',
          dispatched: 'var(--state-dispatched)',
          progress: 'var(--state-progress)',
          done: 'var(--state-done)',
          problem: 'var(--state-problem)',
          pending: 'var(--state-pending)',
        },
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        full: 'var(--radius-full)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      fontSize: {
        display: ['var(--text-display)', { lineHeight: 'var(--text-display-lh)' }],
        h1: ['var(--text-h1)', { lineHeight: 'var(--text-h1-lh)' }],
        h2: ['var(--text-h2)', { lineHeight: 'var(--text-h2-lh)' }],
        h3: ['var(--text-h3)', { lineHeight: 'var(--text-h3-lh)' }],
        body: ['var(--text-body)', { lineHeight: 'var(--text-body-lh)' }],
        caption: ['var(--text-caption)', { lineHeight: 'var(--text-caption-lh)' }],
      },
      spacing: {
        0: 'var(--space-0)',
        1: 'var(--space-1)',
        2: 'var(--space-2)',
        3: 'var(--space-3)',
        4: 'var(--space-4)',
        5: 'var(--space-5)',
        6: 'var(--space-6)',
        8: 'var(--space-8)',
        10: 'var(--space-10)',
        12: 'var(--space-12)',
        16: 'var(--space-16)',
      },
      transitionDuration: {
        fast: 'var(--transition-fast)',
        normal: 'var(--transition)',
        slow: 'var(--transition-slow)',
      },
      transitionTimingFunction: {
        fumibug: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      zIndex: {
        dropdown: 'var(--z-dropdown)',
        sticky: 'var(--z-sticky)',
        'modal-backdrop': 'var(--z-modal-backdrop)',
        modal: 'var(--z-modal)',
        toast: 'var(--z-toast)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-out': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        'slide-in-from-bottom': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'slide-out-to-bottom': {
          from: { transform: 'translateY(0)' },
          to: { transform: 'translateY(100%)' },
        },
        'scale-in': {
          from: { transform: 'scale(0.95)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'fade-out': 'fade-out 150ms ease-out',
        'slide-in': 'slide-in-from-bottom 200ms ease-out',
        'slide-out': 'slide-out-to-bottom 200ms ease-out',
        'scale-in': 'scale-in 150ms ease-out',
        shimmer: 'shimmer 2s infinite linear',
      },
    },
  },
  plugins: [
    animate,
    plugin(function (api) {
      api.addUtilities({
        '.tabular-nums': { fontVariantNumeric: 'tabular-nums' },
        '.touch-min': { minHeight: 'var(--touch-min)', minWidth: 'var(--touch-min)' },
        '.touch-action': {
          minHeight: 'var(--touch-action)',
          minWidth: 'var(--touch-action)',
        },
        '.safe-bottom': {
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        },
        '.safe-top': {
          paddingTop: 'env(safe-area-inset-top, 0px)',
        },
        '.safe-left': {
          paddingLeft: 'env(safe-area-inset-left, 0px)',
        },
        '.safe-right': {
          paddingRight: 'env(safe-area-inset-right, 0px)',
        },
      })
    }),
    plugin(function (api) {
      api.addBase({
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            animationDuration: '0.01ms !important',
            animationIterationCount: '1 !important',
            transitionDuration: '0.01ms !important',
          },
        },
      })
    }),
  ],
} satisfies Partial<Config>

export default fumibugPreset
