import type { MetadataRoute } from 'next'

const pages: { path: string; changeFrequency: 'weekly' | 'monthly'; priority: number }[] = [
  { path: '', changeFrequency: 'weekly', priority: 1 },
  { path: '/faq', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/aide', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/contact', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/confidentialite', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/cgu', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/mentions-legales', changeFrequency: 'monthly', priority: 0.5 },
]

export default function sitemap(): MetadataRoute.Sitemap {
  return pages.map(({ path, changeFrequency, priority }) => ({
    url: `https://tomia.fr${path}`,
    changeFrequency,
    priority,
  }))
}
