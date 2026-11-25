import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import { SITE_ORIGIN, isSitemapExcluded } from './src/lib/site.mjs';

// https://astro.build/config
export default defineConfig({
  site: SITE_ORIGIN,
  trailingSlash: 'never',
  integrations: [
    react(),
    sitemap({
      filter: (page) => !isSitemapExcluded(page),
      serialize(item) {
        const url = new URL(item.url);
        if (url.pathname === '/') return { ...item, url: SITE_ORIGIN };
        url.pathname = url.pathname.replace(/\/+$/, '');
        return { ...item, url: url.href };
      },
    }),
  ],
  output: 'server',
  adapter: vercel({
    maxDuration: 60,
    includeFiles: [
      './wallet-pass-model/icon.png',
      './wallet-pass-model/icon@2x.png',
      './wallet-pass-model/logo.png',
      './wallet-pass-model/logo@2x.png',
    ],
  }),
});
