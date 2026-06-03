import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'yorgos.ai — Επαγγελματικό τηλέφωνο & AI βοηθός',
    short_name: 'yorgos.ai',
    description: 'AI βοηθός για κλήσεις, πελάτες, follow-ups και προσφορές.',
    id: '/dashboard',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'el',
    dir: 'ltr',
    categories: ['business', 'productivity'],
    background_color: '#f5f5f7',
    theme_color: '#4f46e5',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
