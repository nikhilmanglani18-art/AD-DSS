/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        defense: {
          canvas: "#FFFFFF",
          subtle: "#F8FAFC",
          card: "#FFFFFF",
          border: "#E2E8F0",
          borderDark: "#CBD5E1",
          muted: "#64748B",
          dark: "#0F172A",
          heading: "#020617"
        },
        kesari: {
          DEFAULT: "#FF9933",
          50: "#FFF7ED",
          100: "#FFEDD5",
          400: "#FB923C",
          500: "#FF9933",
          600: "#EA580C",
          700: "#C2410C"
        },
        greenTricolor: {
          DEFAULT: "#138808",
          50: "#F0FDF4",
          100: "#DCFCE7",
          500: "#22C55E",
          600: "#138808",
          700: "#15803D",
          800: "#166534"
        },
        navyCommand: {
          DEFAULT: "#000080",
          50: "#EEF2FF",
          100: "#E0E7FF",
          600: "#1D4ED8",
          700: "#1E40AF",
          800: "#000080",
          900: "#000055",
          950: "#020626"
        },
        threatRed: {
          DEFAULT: "#DC2626",
          50: "#FEF2F2",
          100: "#FEE2E2",
          500: "#EF4444",
          600: "#DC2626",
          700: "#B91C1C"
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'Roboto Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'tactical': '0 1px 3px 0 rgba(15, 23, 42, 0.08), 0 1px 2px -1px rgba(15, 23, 42, 0.08)',
        'tactical-md': '0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.06)',
        'tactical-lg': '0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.05)',
      }
    },
  },
  plugins: [],
}
