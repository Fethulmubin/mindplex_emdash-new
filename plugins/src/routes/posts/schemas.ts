import { z } from "astro/zod";

export type ListPostsParams = {
  type?: string;
  feed?: string;
  sort?: string;
  limit?: number;
  cursor?: string;
};

export type ListCommentsParams = {
  limit?: number;
  cursor?: string;
};

export const CreatePostSchema = z.object({
  title: z.string().min(1),
  content: z.any(),
  type: z.string().min(1),
  slug: z.string().min(1).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  published_at: z.string().min(1).optional(),
  excerpt: z.string().optional(),
  author: z.string().optional(),
  comment_enabled: z.boolean().optional(),
  is_editors_pick: z.boolean().optional(),
  estimated_reading_minutes: z.number().int().min(0).optional(),
  origin_resource: z.string().optional(),
});

export type CreatePostInput = z.infer<typeof CreatePostSchema>;
