/** @type {import('tailwindcss').Config} */
export default {
  corePlugins: { preflight: false },
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}'],
  theme: {
    extend: {
      colors: {
        space:  '#050505', // Deep Space Black — page background
        ghost:  '#F8F8FF', // Ghost White — primary text
        ash:    '#D3D3D3', // Light Ash — secondary text
        orange: '#fa6602', // Vibrant Orange — accent / headers / HUD
        alert:  '#E63946', // Alert Red — warnings / "something went wrong"
        crt:    '#33ff66', // Phosphor green — terminal / mini-game screen
      },
      fontFamily: {
        display: ['"Archivo Black"', 'system-ui', 'sans-serif'],
        sans:    ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono:    ['"Roboto Mono"', 'ui-monospace', 'monospace'],
        term:    ['"Share Tech Mono"', '"Roboto Mono"', 'monospace'],
      },
      keyframes: {
        blink:    { '0%,49%': { opacity: '1' }, '50%,100%': { opacity: '0' } },
        scanline: { from: { transform: 'translateY(-100%)' }, to: { transform: 'translateY(100%)' } },
        flicker:  { '0%,100%': { opacity: '.96' }, '50%': { opacity: '.88' } },
        drift:    { from: { backgroundPosition: '0 0, 0 0, 0 0' }, to: { backgroundPosition: '-400px 400px, 300px -300px, -200px -200px' } },
        pulse2:   { '0%,100%': { opacity: '.55' }, '50%': { opacity: '1' } },
      },
      animation: {
        blink:    'blink 1s step-end infinite',
        scanline: 'scanline 6s linear infinite',
        flicker:  'flicker 3s steps(12) infinite',
        drift:    'drift 200s linear infinite',
        pulse2:   'pulse2 2.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
