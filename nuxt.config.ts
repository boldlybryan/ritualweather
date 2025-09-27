// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'],
  app: {
    head: {
      link: [
        { rel: 'manifest', href: '/manifest.json' },
        { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/icon-192x192.png' },
        { rel: 'icon', type: 'image/png', sizes: '512x512', href: '/icon-512x512.png' },
        { rel: 'apple-touch-icon', href: '/icon-192x192.png' }
      ],
      meta: [
        { name: 'theme-color', content: '#000' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'apple-mobile-web-app-title', content: 'Ritual Weather' }
      ]
    }
  }
})