import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const imageSchema = z
  .object({
    src: z.string(),
    alt: z.string(),
    width: z.number().int(),
    height: z.number().int(),
  })
  .strict();

const seoSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    ogImage: imageSchema.optional(),
  })
  .strict();

const postSchema = z
  .object({
    slug: z.string(),
    title: z.string(),
    excerpt: z.string(),
    status: z.enum(['draft', 'published', 'archived']),
    publishedAt: z.string().optional(),
    updatedAt: z.string().optional(),
    authorId: z.string(),
    tagSlugs: z.array(z.string()),
    categorySlug: z.string().optional(),
    series: z
      .object({
        slug: z.string(),
        order: z.number().int(),
      })
      .strict()
      .optional(),
    cover: imageSchema.optional(),
    seo: seoSchema.optional(),
  })
  .strict();

const aboutSchema = z
  .object({
    title: z.string(),
    description: z.string(),
    authorId: z.string(),
    seo: seoSchema.optional(),
  })
  .strict();

export const collections = {
  posts: defineCollection({
    loader: glob({ pattern: '**/*.md', base: './content/posts' }),
    schema: postSchema,
  }),
  about: defineCollection({
    loader: glob({ pattern: 'about.md', base: './content' }),
    schema: aboutSchema,
  }),
};
