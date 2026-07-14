import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import icon from 'astro-icon';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [mdx(), react(), icon(), tailwind()],
  site: 'https://rdgonzaga.github.io',
  base: 'memory-block-blast',
});
