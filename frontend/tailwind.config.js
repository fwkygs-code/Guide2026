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
          DEFAULT: 'hsl(var(--primary))', // Uses CSS variable - Apple Blue
          foreground: 'hsl(var(--primary-foreground))',
          // Keep shade variants for explicit usage (e.g., primary-500)
          50: '#E3F2FD',
          100: '#BBDEFB',
          500: '#007AFF',
          600: '#0051D5',
          700: '#003D9E',
          900: '#001F4F'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))', // Uses CSS variable
          foreground: 'hsl(var(--secondary-foreground))',
          // Keep shade variants for explicit usage
          50: '#FAFAFA',
          100: '#F5F5F7',
          200: '#E5E5E7',
          800: '#3A3A3C',
          900: '#1D1D1F'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))', // Uses CSS variable
          foreground: 'hsl(var(--accent-foreground))'
        },
        success: {
          DEFAULT: '#10b981',
          foreground: '#ffffff'
        },
        warning: {
          DEFAULT: '#5AC8FA', // Transparent Blue - 3D effect
          50: '#E3F5FF',
          100: '#B3E5FF',
          200: '#80D5FF',
          300: '#5AC8FA',
          400: '#3AB8F5',
          500: '#0EA5E9',
          600: '#0C8FD4',
          700: '#0A7ABF',
          foreground: '#ffffff'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))', // Uses CSS variable - Apple Red
          foreground: 'hsl(var(--destructive-foreground))'
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
        lg: '1rem',
        md: '0.75rem',
        sm: '0.5rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
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