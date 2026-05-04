import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://veilguard.dev', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: 'https://veilguard.dev/pro', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: 'https://veilguard.dev/docs', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: 'https://veilguard.dev/docs/install', lastModified: new Date(), priority: 0.8 },
    { url: 'https://veilguard.dev/docs/scanners', lastModified: new Date(), priority: 0.8 },
    { url: 'https://veilguard.dev/docs/autoscan', lastModified: new Date(), priority: 0.7 },
    { url: 'https://veilguard.dev/docs/scoring', lastModified: new Date(), priority: 0.6 },
    { url: 'https://veilguard.dev/docs/fintech', lastModified: new Date(), priority: 0.6 },
    { url: 'https://veilguard.dev/docs/faq', lastModified: new Date(), priority: 0.6 },
  ];
}
