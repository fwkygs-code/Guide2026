module.exports = {
  darkMode: ['class'],
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['Manrope', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: '#4f46e5',
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          900: '#312e81',
          foreground: '#ffffff'
        },
        secondary: {
          DEFAULT: '#f1f5f9',
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          800: '#1e293b',
          900: '#0f172a',
          foreground: '#0f172a'
        },
        accent: {
          DEFAULT: '#0ea5e9',
          foreground: '#ffffff'
        },
        success: {
          DEFAULT: '#10b981',
          foreground: '#ffffff'
        },
        warning: {
          DEFAULT: '#f59e0b',
          foreground: '#ffffff'
        },
        destructive: {
          DEFAULT: '#ef4444',
          foreground: '#ffffff'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        }
      },
      borderRadius: {
        lg: '0.75rem',
        md: '0.5rem',
        sm: '0.25rem',
        xl: '1rem',
        '2xl': '1.5rem',
        full: '9999px'
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0, 0, 0, 0.04)',
        'soft-lg': '0 8px 24px rgba(0, 0, 0, 0.08)',
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)'
      },
      backdropBlur: {
        xs: '2px',
        sm: '4px',
        md: '12px',
        lg: '24px'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
}