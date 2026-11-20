/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      // The app asks before switching to a new version (src/shared/UpdateBanner.tsx), which also registers the worker.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,jpg,svg}'],
        cleanupOutdatedCaches: true,
        // Product data comes from Open Food Facts; it is never cached by the worker, only saved as "my products".
        navigateFallbackDenylist: [/^\/api\//],
      },
      manifest: {
        name: 'Jadłospis',
        short_name: 'Jadłospis',
        description: 'Dziennik kalorii i makroskładników',
        lang: 'pl',
        id: './',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        categories: ['health', 'food', 'lifestyle'],
        background_color: '#0e0e0e',
        theme_color: '#0e0e0e',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: { environment: 'node' },
});
