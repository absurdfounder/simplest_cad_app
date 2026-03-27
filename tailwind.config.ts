import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'cad-bg': '#1a1a2e',
        'cad-surface': '#16213e',
        'cad-accent': '#0f3460',
        'cad-highlight': '#e94560',
        'cad-text': '#eaeaea',
        'cad-muted': '#8892b0',
        'cad-border': '#2a2a4a',
        'cad-success': '#4ade80',
        'cad-warning': '#fbbf24',
      },
    },
  },
  plugins: [],
};

export default config;
