/** @type {import('tailwindcss').Config} */
import forms from '@tailwindcss/forms';
import containerQueries from '@tailwindcss/container-queries';

export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "on-secondary-fixed-variant": "var(--color-on-secondary-fixed-variant)",
        "surface-container-highest": "var(--color-surface-container-highest)",
        "surface-tint": "var(--color-surface-tint)",
        "outline-variant": "var(--color-outline-variant)",
        "on-primary-container": "var(--color-on-primary-container)",
        "tertiary": "var(--color-tertiary)",
        "primary": "var(--color-primary)",
        "surface-container-low": "var(--color-surface-container-low)",
        "inverse-primary": "var(--color-inverse-primary)",
        "on-secondary-fixed": "var(--color-on-secondary-fixed)",
        "secondary-fixed-dim": "var(--color-secondary-fixed-dim)",
        "on-tertiary": "var(--color-on-tertiary)",
        "tertiary-container": "var(--color-tertiary-container)",
        "error-container": "var(--color-error-container)",
        "secondary": "var(--color-secondary)",
        "surface": "var(--color-surface)",
        "on-primary-fixed-variant": "var(--color-on-primary-fixed-variant)",
        "on-error-container": "var(--color-on-error-container)",
        "on-tertiary-fixed": "var(--color-on-tertiary-fixed)",
        "on-primary-fixed": "var(--color-on-primary-fixed)",
        "outline": "var(--color-outline)",
        "on-background": "var(--color-on-background)",
        "primary-fixed": "var(--color-primary-fixed)",
        "primary-fixed-dim": "var(--color-primary-fixed-dim)",
        "secondary-fixed": "var(--color-secondary-fixed)",
        "secondary-container": "var(--color-secondary-container)",
        "surface-container-lowest": "var(--color-surface-container-lowest)",
        "on-secondary-container": "var(--color-on-secondary-container)",
        "on-primary": "var(--color-on-primary)",
        "surface-container": "var(--color-surface-container)",
        "tertiary-fixed": "var(--color-tertiary-fixed)",
        "background": "var(--color-background)",
        "on-error": "var(--color-on-error)",
        "surface-variant": "var(--color-surface-variant)",
        "on-surface": "var(--color-on-surface)",
        "surface-bright": "var(--color-surface-bright)",
        "on-tertiary-container": "var(--color-on-tertiary-container)",
        "tertiary-fixed-dim": "var(--color-tertiary-fixed-dim)",
        "error": "var(--color-error)",
        "on-surface-variant": "var(--color-on-surface-variant)",
        "surface-container-high": "var(--color-surface-container-high)",
        "on-secondary": "var(--color-on-secondary)",
        "surface-dim": "var(--color-surface-dim)",
        "inverse-on-surface": "var(--color-inverse-on-surface)",
        "on-tertiary-fixed-variant": "var(--color-on-tertiary-fixed-variant)",
        "primary-container": "var(--color-primary-container)",
        "inverse-surface": "var(--color-inverse-surface)"
      },
      borderRadius: {
        "DEFAULT": "0.125rem",
        "lg": "0.25rem",
        "xl": "0.5rem",
        "full": "0.75rem"
      },
      spacing: {
        "card-padding": "1.25rem",
        "container-max": "1440px",
        "stack-gap": "0.75rem",
        "sidebar-width": "240px",
        "gutter": "1.5rem"
      },
      fontFamily: {
        "label-md": ["Geist", "sans-serif"],
        "label-sm": ["Geist", "sans-serif"],
        "body-lg": ["Inter", "sans-serif"],
        "headline-md": ["Inter", "sans-serif"],
        "headline-sm": ["Inter", "sans-serif"],
        "display-lg": ["Inter", "sans-serif"],
        "body-md": ["Inter", "sans-serif"],
        "display-lg-mobile": ["Inter", "sans-serif"]
      },
      fontSize: {
        "label-md": ["12px", { lineHeight: "16px", letterSpacing: "0.02em", fontWeight: "500" }],
        "label-sm": ["11px", { lineHeight: "14px", letterSpacing: "0.05em", fontWeight: "600" }],
        "body-lg": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "headline-md": ["24px", { lineHeight: "32px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "headline-sm": ["20px", { lineHeight: "28px", fontWeight: "600" }],
        "display-lg": ["30px", { lineHeight: "38px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "body-md": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "display-lg-mobile": ["24px", { lineHeight: "32px", fontWeight: "700" }]
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        }
      },
      animation: {
        slideIn: 'slideIn 0.3s ease-out forwards',
        fadeIn: 'fadeIn 0.3s ease-out forwards',
      }
    },
  },
  plugins: [
    forms,
    containerQueries,
  ],
}
