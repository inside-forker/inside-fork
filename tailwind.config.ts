import type { Config } from "tailwindcss"
import tailwindcssAnimate from "tailwindcss-animate"
import typography from "@tailwindcss/typography"

const config = {
  darkMode: "class",
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  prefix: "",
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		fontFamily: {
  			// Inter, loaded by next/font in app/layout.tsx, same face as the mobile app
  			sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
  			// Design-system faces (next/font variables set in app/layout.tsx)
  			display: ['var(--font-display)', 'Georgia', '"Times New Roman"', 'serif'],
  			ui: ['var(--font-ui)', 'var(--font-sans)'],
  			'mono-label': ['var(--font-mono-label)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
  		},
  		colors: {
  			// Brand palette (logo): cream surfaces and ink text alongside the pink primary
  			cream: 'hsl(var(--cream) / <alpha-value>)',
  			ink: 'hsl(var(--ink) / <alpha-value>)',
  			// Status tones for admin badges and deltas
  			success: 'hsl(var(--success) / <alpha-value>)',
  			warning: 'hsl(var(--warning) / <alpha-value>)',
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
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
  		fontSize: {
  			// 13/20 data step for dense admin tables, chips and meta
  			data: ['0.8125rem', { lineHeight: '1.25rem' }],
  			// Design-system type scale. Display sizes are fluid (390px -> 1440px).
  			'display-xl': ['clamp(3rem, 1.9rem + 4.5vw, 6rem)', { lineHeight: '1.02', letterSpacing: '-0.035em' }],
  			'display-lg': ['clamp(2.5rem, 1.7rem + 3.3vw, 4.5rem)', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
  			'display-md': ['clamp(2rem, 1.5rem + 2vw, 3.25rem)', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
  			title: ['1.5rem', { lineHeight: '1.25', letterSpacing: '-0.01em' }],
  			'body-lg': ['1.125rem', { lineHeight: '1.6' }],
  			body: ['1rem', { lineHeight: '1.6' }],
  			small: ['0.875rem', { lineHeight: '1.5' }],
  			label: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.02em' }]
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)',
  			// Design-system hierarchy: controls < media < containers
  			control: 'var(--radius-control)',
  			media: 'var(--radius-media)',
  			container: 'var(--radius-container)'
  		},
  		// One shadow token, for floating layers only
  		boxShadow: {
  			overlay: 'var(--shadow-overlay)'
  		},
  		// Motion tokens (mirrored in lib/motion.ts)
  		transitionDuration: {
  			fast: 'var(--duration-fast)',
  			base: 'var(--duration-base)',
  			slow: 'var(--duration-slow)'
  		},
  		transitionTimingFunction: {
  			standard: 'var(--ease-standard)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			// Admin refetch bar: a 40% segment sweeping across a 2px track
  			indeterminate: {
  				from: { transform: 'translateX(-100%)' },
  				to: { transform: 'translateX(250%)' }
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			indeterminate: 'indeterminate 1.2s ease-in-out infinite'
  		}
  	}
  },
  plugins: [tailwindcssAnimate, typography],
} satisfies Config

export default config
