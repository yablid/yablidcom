import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/projects" }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    type: z.string().optional(),
    section: z.string().optional(),
    createdAt: z.coerce.date(),
    githubRepo: z.string().optional(),
  }),
});

const byproducts = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/byproducts" }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    type: z.string().optional(),
    section: z.string().optional(),
    createdAt: z.coerce.date(),
    githubRepo: z.string().optional(),
  }),
});

const thoughts = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/thoughts" }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    type: z.string().optional(),
    section: z.string().optional(),
    createdAt: z.coerce.date(),
    githubRepo: z.string().optional(),
  }),
});

export const collections = {
  projects,
  byproducts,
  thoughts,
};
