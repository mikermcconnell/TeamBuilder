/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: ['class'],
	content: [
		'./pages/**/*.{ts,tsx}',
		'./components/**/*.{ts,tsx}',
		'./app/**/*.{ts,tsx}',
		'./src/**/*.{ts,tsx}',
	],
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px',
			},
		},
		extend: {
			fontFamily: {
				sans: ['Nunito', 'sans-serif'],
			},
			colors: {
				border: '#E5E5E5', // Light gray border
				input: '#E5E5E5',
				ring: '#58CC02',
				background: '#F7F7F7', // Light gray background
				foreground: '#4B4B4B', // Dark gray text like Duolingo
				primary: {
					DEFAULT: '#58CC02', // Main Lime Green
					foreground: '#FFFFFF',
					shadow: '#58A700', // Darker green for 3D effect
				},
				secondary: {
					DEFAULT: '#1CB0F6', // Sky Blue
					foreground: '#FFFFFF',
					shadow: '#1899D6',
				},
				accent: {
					DEFAULT: '#FFC800', // Gold/Yellow
					foreground: '#FFFFFF',
					shadow: '#E5B400',
				},
				danger: {
					DEFAULT: '#FF4B4B', // Red
					foreground: '#FFFFFF',
					shadow: '#EA2B2B',
				},
				card: {
					DEFAULT: '#FFFFFF',
					foreground: '#4B4B4B',
				},
				popover: {
					DEFAULT: '#FFFFFF',
					foreground: '#4B4B4B',
				},
				muted: {
					DEFAULT: '#F7F7F7',
					foreground: '#AFAFAF',
				},
			},
			borderRadius: {
				lg: '1rem', // 16px
				md: '0.75rem', // 12px
				sm: '0.5rem', // 8px
				xl: '1.25rem', // 20px
				'2xl': '1.5rem', // 24px
				'3xl': '2rem', // 32px
			},
			boxShadow: {
				'3d': '0 4px 0 0 var(--tw-shadow-color)',
			},
			keyframes: {
				'accordion-down': {
					from: { height: 0 },
					to: { height: 'var(--radix-accordion-content-height)' },
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: 0 },
				},
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
			},
		},
	},
	plugins: [require('tailwindcss-animate')],
}