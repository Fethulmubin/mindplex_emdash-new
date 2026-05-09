import type { PluginContext } from "emdash";
import type { CreatePostInput, ListCommentsParams, ListPostsParams } from "./schemas";

function generateSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function extractListItems(result: any) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.items)) return result.items;
  if (Array.isArray(result?.data)) return result.data;
  return [];
}

function getIdentifierFromRoute(routeCtx: any): string | null {
  if (routeCtx?.params?.identifier) return routeCtx.params.identifier;

  const url = new URL(routeCtx.request.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const postsIndex = segments.lastIndexOf("posts");

  if (postsIndex >= 0 && segments[postsIndex + 1]) {
    return segments[postsIndex + 1];
  }

  return null;
}

async function getPosts(ctx: PluginContext, params: ListPostsParams) {
  const options: any = {
    limit: Math.min(params.limit ?? 10, 100),
    cursor: params.cursor,
    where: {
      status: "published",
    },
  };

  if (params.type) {
    options.where.type = params.type;
  }

  if (params.feed === "editors-pick") {
    options.where.is_editors_pick = true;
  }

  return ctx.content!.list("posts", options);
}

async function getPostByIdentifier(ctx: PluginContext, identifier: string) {
  const where: any = {};
  if (/^\d+$/.test(identifier)) {
    where.id = Number(identifier);
  } else {
    where.slug = identifier;
  }

  const result = await ctx.content!.list("posts", { limit: 1, where });
  const items = extractListItems(result);

  return items[0] || null;
}

async function listComments(
  ctx: PluginContext,
  params: ListCommentsParams & { postId: string | number },
) {
  const options: any = {
    limit: Math.min(params.limit ?? 10, 100),
    cursor: params.cursor,
    where: {
      post_id: params.postId,
    },
  };

  return ctx.content!.list("comments", options);
}

async function createPost(ctx: PluginContext, input: CreatePostInput) {
  ctx.log.info(`[createPost] Starting creation for title: ${input.title}`);

  const slug = input.slug?.trim() || generateSlug(input.title);

  let publishedAt: string | undefined;
  if (input.published_at) {
    publishedAt = new Date(input.published_at).toISOString();
  } else if (input.status === "published") {
    publishedAt = new Date().toISOString();
  }

  const payload: any = {
    title: input.title,
    content:
      typeof input.content === "string"
        ? [{ _type: "block", children: [{ _type: "span", text: input.content }] }]
        : input.content,
    type: input.type,
    slug,
    status: input.status || "draft",
    published_at: publishedAt,
    excerpt: input.excerpt,
    author: input.author,
    comment_enabled: input.comment_enabled ?? true,
    is_editors_pick: input.is_editors_pick ?? false,
    estimated_reading_minutes: input.estimated_reading_minutes || 0,
    origin_resource: input.origin_resource,
  };

  if (!ctx.content) throw new Error("Content service is not initialized in PluginContext");
  return ctx.content.create!("posts", payload);
}

export async function getPostsHandler(routeCtx: any, ctx: PluginContext) {
  const url = new URL(routeCtx.request.url);
  const type = url.searchParams.get("type");
  const feed = url.searchParams.get("feed");
  const sort = url.searchParams.get("sort");
  const limit = parseInt(url.searchParams.get("limit") || "10", 10);
  const cursor = url.searchParams.get("cursor") || undefined;

  try {
    const result = await getPosts(ctx, {
      type: type || undefined,
      feed: feed || undefined,
      sort: sort || undefined,
      limit,
      cursor,
    });
    return { success: true, data: result };
  } catch (error: any) {
    ctx.log.error("Plugin Error: Failed to list posts", { error: error.message });
    return { success: false, error: "Failed to fetch posts." };
  }
}

export async function getPostHandler(routeCtx: any, ctx: PluginContext) {
  const identifier = getIdentifierFromRoute(routeCtx);
  if (!identifier) return { success: false, error: "Post identifier is required." };

  try {
    const post = await getPostByIdentifier(ctx, identifier);
    if (!post) return { success: false, error: "Post not found." };
    return { success: true, data: post };
  } catch (error: any) {
    ctx.log.error("Plugin Error: Failed to get post", { error: error.message });
    return { success: false, error: "Failed to fetch post." };
  }
}

export async function createPostHandler(routeCtx: any, ctx: PluginContext) {
  try {
    const post = await createPost(ctx, routeCtx.input as CreatePostInput);
    return { status: true, post };
  } catch (error: any) {
    ctx.log.error("Plugin Error: Failed to create post", { error: error.message });
    return { success: false, error: "Failed to create post." };
  }
}

export async function listPostCommentsHandler(routeCtx: any, ctx: PluginContext) {
  const identifier = getIdentifierFromRoute(routeCtx);
  if (!identifier) return { success: false, error: "Post identifier is required." };

  const url = new URL(routeCtx.request.url);
  const limit = parseInt(url.searchParams.get("limit") || "10", 10);
  const cursor = url.searchParams.get("cursor") || undefined;

  try {
    const post = await getPostByIdentifier(ctx, identifier);
    if (!post) return { success: false, error: "Post not found." };

    const params: ListCommentsParams = { limit, cursor };
    const result = await listComments(ctx, { ...params, postId: post.id });
    return { success: true, data: result };
  } catch (error: any) {
    ctx.log.error("Plugin Error: Failed to list comments", { error: error.message });
    return { success: false, error: "Failed to fetch comments." };
  }
}
