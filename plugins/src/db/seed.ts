/**
 * Database Seed Script
 *
 * Populates the local dev database with realistic fake data.
 * Includes all three WordPress password hash formats so the team
 * can test the legacy → Argon2id migration flow on login.
 *
 * All passwords for seed users are: "password123"
 *
 * Usage:
 *   node src/db/seed.ts
 *
 * WARNING: This will truncate all tables. Never run against production.
 */

import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import * as schema from "./schema/index";
import { relations } from "./schema/relations";
import { hash } from "@node-rs/argon2";

// ─── DB Connection ──────────────────────────────────────────────

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_USE_SSL === "true" ? { rejectUnauthorized: false } : false,
});

const db = drizzle(pool);

// ─── Helpers ────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, n);
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDecimal(min: number, max: number, precision = 8) {
  return (Math.random() * (max - min) + min).toFixed(precision);
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function slug(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ─── Seed Password Hashes ───────────────────────────────────────
// All hashes correspond to "password123"
// Generated from actual WordPress installations for accuracy

// PHPass ($P$) — WordPress < 6.8 default
const PHPASS_HASH = "$P$BnjRrzTskQqhsDfhQbpSjVYq3g2ead/";

// WP Bcrypt ($wp$2y$) — WordPress 6.8+ with SHA-384 pre-hashing
// Created with: password_hash(base64_encode(hash_hmac('sha384', 'password123', 'wp-sha384', true)), PASSWORD_BCRYPT)
const WP_BCRYPT_HASH = "$wp$2y$10$YR8hN8KQiVFJhB1Qs0G8TuBpR6k0MjKCqzVHS1DBqdpD3kXBWqPxW";

// Argon2id — already migrated (our target format)
// Will be generated at seed time via Bun.password.hash
let ARGON2_HASH = "";

// ─── Fake Data Pools ────────────────────────────────────────────

const FIRST_NAMES = [
  "Alex",
  "Jordan",
  "Taylor",
  "Morgan",
  "Casey",
  "Riley",
  "Quinn",
  "Avery",
  "Sage",
  "River",
  "Kai",
  "Rowan",
  "Dakota",
  "Phoenix",
  "Skyler",
  "Finley",
  "Harley",
  "Reese",
  "Blair",
  "Drew",
];

const LAST_NAMES = [
  "Chen",
  "Patel",
  "Kim",
  "Santos",
  "Okafor",
  "Mueller",
  "Silva",
  "Tanaka",
  "Johansson",
  "Ali",
  "Nakamura",
  "Petrov",
  "Andersen",
  "Morales",
  "Ibrahim",
  "Kowalski",
  "Fischer",
  "Yamamoto",
  "Nguyen",
  "Park",
];

const POST_TITLES = [
  "The Future of Decentralized AI Governance",
  "Why Neuro-Symbolic AI Might Be the Next Breakthrough",
  "Understanding Collective Intelligence in Digital Communities",
  "How Blockchain Is Reshaping Scientific Publishing",
  "The Ethics of Autonomous Decision-Making Systems",
  "Open Source vs Proprietary AI: A 2025 Perspective",
  "Demystifying Zero-Knowledge Proofs for Non-Cryptographers",
  "Building Trust in AI Systems Through Transparency",
  "The Role of Tokenomics in Community-Driven Platforms",
  "Digital Identity and Self-Sovereign Data Ownership",
  "When Machines Debate: AI in Deliberative Democracy",
  "Post-AGI Economics: Speculations and Scenarios",
  "Federated Learning: Privacy-Preserving AI at Scale",
  "The Intersection of Neuroscience and Artificial Intelligence",
  "Cognitive Biases in AI Training Data",
  "Web3 Social Networks: Promise vs Reality",
  "AI Safety Research: Where We Stand in 2025",
  "The Case for Decentralized Content Moderation",
  "Quantum Computing's Impact on Cryptographic Security",
  "From GPT to AGI: A Realistic Timeline Assessment",
];

const PARAGRAPHS = [
  "Artificial intelligence continues to reshape the way we think about problem-solving, creativity, and collaboration. As models grow more capable, the conversation shifts from what AI can do to what it should do.",
  "The decentralized web offers a fundamentally different paradigm for how we organize information, incentivize participation, and distribute power. But the gap between idealism and implementation remains wide.",
  "Community-driven platforms face a unique challenge: balancing openness with quality. Without thoughtful governance mechanisms, the loudest voices often drown out the most insightful ones.",
  "Recent advances in transformer architectures have pushed the boundaries of natural language understanding, but fundamental questions about reasoning, grounding, and alignment remain open.",
  "The intersection of blockchain and AI is often dismissed as hype, but there are genuine use cases where cryptographic guarantees complement machine learning capabilities in meaningful ways.",
  "Privacy-preserving computation techniques like homomorphic encryption and secure multi-party computation are maturing rapidly, opening doors to collaborative AI without data sharing.",
];

const COMMENTS_POOL = [
  "Great analysis, really helped me understand the nuances here.",
  "I disagree with the premise — the evidence points in a different direction.",
  "This is exactly the kind of content we need more of in this space.",
  "Interesting perspective. Have you considered the counterargument about scalability?",
  "The section on governance was particularly insightful.",
  "I'd love to see a follow-up that dives deeper into the technical implementation.",
  "Sharing this with my team. Very relevant to what we're building.",
  "Solid research but I think the conclusion oversimplifies a complex issue.",
  "First time reading this publication — impressed by the depth.",
  "This aligns with the recent paper from DeepMind on the same topic.",
];

const TAXONOMY_CATEGORIES = [
  { name: "Artificial Intelligence", type: "category" as const },
  { name: "Blockchain", type: "category" as const },
  { name: "Neuroscience", type: "category" as const },
  { name: "Philosophy", type: "category" as const },
  { name: "Technology", type: "category" as const },
  { name: "Science", type: "category" as const },
];

const TAXONOMY_TAGS = [
  "machine-learning",
  "deep-learning",
  "nlp",
  "computer-vision",
  "ethics",
  "governance",
  "decentralization",
  "web3",
  "privacy",
  "security",
  "open-source",
  "research",
  "opinion",
  "tutorial",
  "news-analysis",
  "podcast-notes",
];

const FAQ_ITEMS = [
  {
    q: "How do I create an account?",
    a: "Click the Sign Up button in the top right corner and follow the registration steps.",
  },
  {
    q: "How does the reputation system work?",
    a: "Your reputation is calculated from your interactions including posts, comments, and community votes.",
  },
  {
    q: "Can I connect my crypto wallet?",
    a: "Yes, go to Settings → Wallet and connect your wallet using the supported providers.",
  },
  {
    q: "How do I reset my password?",
    a: "Click Forgot Password on the login page and follow the email instructions.",
  },
  {
    q: "What are People's Choice votes?",
    a: "Community members can vote on articles they think deserve special recognition.",
  },
  {
    q: "How do polls work?",
    a: "Editors can attach polls to articles. You get one vote per poll unless it's marked as multiple choice.",
  },
];

const INTERESTS = [
  "Artificial Intelligence",
  "Machine Learning",
  "Blockchain",
  "Neuroscience",
  "Philosophy of Mind",
  "Cryptography",
  "Data Science",
  "Robotics",
  "Quantum Computing",
  "Ethics",
  "Cognitive Science",
  "Web Development",
];

const EDUCATION_OPTIONS = [
  "BSc Computer Science",
  "MSc Artificial Intelligence",
  "PhD Neuroscience",
  "BA Philosophy",
  "MSc Data Science",
  "Self-taught Developer",
  "BSc Mathematics",
  "MBA Technology Management",
  "PhD Computational Linguistics",
];

// ─── Seed Functions ─────────────────────────────────────────────

async function seedUsers() {
  console.log("  Seeding users...");

  // Generate Argon2 hash at runtime
  ARGON2_HASH = await hash("password123", {
    memoryCost: 65536,
    timeCost: 2,
  });

  const passwordHashes = [PHPASS_HASH, WP_BCRYPT_HASH, ARGON2_HASH];

  const userRecords: (typeof schema.users.$inferInsert)[] = [];

  // Admin user — always Argon2
  userRecords.push({
    username: "admin",
    email: "admin@mindplex.local",
    passwordHash: ARGON2_HASH,
    role: "admin",
    isActivated: true,
    updatedAt: new Date(),
  });

  // Moderator
  userRecords.push({
    username: "mod_alex",
    email: "mod@mindplex.local",
    passwordHash: WP_BCRYPT_HASH,
    role: "moderator",
    isActivated: true,
    updatedAt: new Date(),
  });

  // Editor
  userRecords.push({
    username: "editor_jordan",
    email: "editor@mindplex.local",
    passwordHash: PHPASS_HASH,
    role: "editor",
    isActivated: true,
    updatedAt: new Date(),
  });

  // Regular users — mix of hash types to test migration
  for (let i = 0; i < 17; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[i % LAST_NAMES.length];
    const username = `${first.toLowerCase()}_${last.toLowerCase()}`;

    userRecords.push({
      username,
      email: `${username}@mindplex.local`,
      passwordHash: passwordHashes[i % 3], // Rotate through all 3 hash types
      role: i < 2 ? "collaborator" : "user",
      isActivated: i < 15, // Last 2 users are not activated (for testing)
      updatedAt: new Date(),
    });
  }

  const inserted = await db.insert(schema.users).values(userRecords).returning();
  console.log(`    → ${inserted.length} users`);
  return inserted;
}

async function seedUserProfiles(users: { id: number }[]) {
  console.log("  Seeding user profiles...");

  const profiles = users.map((u, i) => ({
    userId: u.id,
    firstName: FIRST_NAMES[i % FIRST_NAMES.length],
    lastName: LAST_NAMES[i % LAST_NAMES.length],
    avatarUrl: `https://api.dicebear.com/8.x/thumbs/svg?seed=${u.id}`,
    bio:
      i % 3 === 0
        ? "AI researcher and decentralization enthusiast."
        : i % 3 === 1
          ? "Building the future of community-driven knowledge."
          : "Exploring the intersection of technology and society.",
    gender: pick(["male", "female", "non-binary", "prefer not to say"]),
    socialMedia: {
      twitter: i % 2 === 0 ? `@user_${u.id}` : undefined,
      github: i % 3 === 0 ? `gh_user_${u.id}` : undefined,
    },
  }));

  await db.insert(schema.userProfiles).values(profiles);
  console.log(`    → ${profiles.length} profiles`);
}

async function seedUserPreferences(users: { id: number }[]) {
  console.log("  Seeding user preferences...");

  const prefs = users.map((u) => ({
    userId: u.id,
    theme: pick(["light", "dark", "system"]) as "light" | "dark" | "system",
    privacyAge: pick(["public", "private", "followersOnly"]) as "public" | "private" | "followersOnly",
    privacyGender: "private" as const,
    privacyEducation: pick(["public", "private"]) as "public" | "private",
  }));

  await db.insert(schema.userPreferences).values(prefs);
  console.log(`    → ${prefs.length} preferences`);
}

async function seedNotificationSettings(users: { id: number }[]) {
  console.log("  Seeding notification settings...");

  const settings = users.map((u) => ({
    userId: u.id,
    notifyPublications: true,
    notifyFollower: true,
    notifyInteraction: Math.random() > 0.3,
    notifyWeekly: Math.random() > 0.5,
    notifyUpdates: true,
  }));

  await db.insert(schema.userNotificationSettings).values(settings);
  console.log(`    → ${settings.length} notification settings`);
}

async function seedUserInterestsAndEducation(users: { id: number }[]) {
  console.log("  Seeding interests & education...");

  const interests: (typeof schema.userInterests.$inferInsert)[] = [];
  const education: (typeof schema.userEducation.$inferInsert)[] = [];

  for (const u of users) {
    const userInterests = pickN(INTERESTS, randomInt(2, 5));
    userInterests.forEach((interest, i) => {
      interests.push({
        userId: u.id,
        interest,
        isPrimary: i === 0,
        isEnabled: true,
      });
    });

    education.push({
      userId: u.id,
      educationalBackground: pick(EDUCATION_OPTIONS),
      isEnabled: true,
    });
  }

  await db.insert(schema.userInterests).values(interests);
  await db.insert(schema.userEducation).values(education);
  console.log(`    → ${interests.length} interests, ${education.length} education records`);
}

async function seedWallets(users: { id: number }[]) {
  console.log("  Seeding wallets...");

  // ~60% of users have wallets
  const walletUsers = users.filter(() => Math.random() > 0.4);
  const wallets = walletUsers.map((u) => ({
    userId: u.id,
    publicAddress: `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(20))).toString("hex")}`,
    isVerified: Math.random() > 0.3,
    paymentAddress:
      Math.random() > 0.5 ? `addr1_${Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("hex")}` : null,
    isPaymentVerified: false,
    updatedAt: new Date(),
  }));

  if (wallets.length > 0) {
    await db.insert(schema.userWallets).values(wallets);
  }
  console.log(`    → ${wallets.length} wallets`);
}

async function seedSocialAuths(users: { id: number }[]) {
  console.log("  Seeding social auths...");

  const auths: (typeof schema.userSocialAuths.$inferInsert)[] = [];
  const providers = ["google", "apple", "facebook"] as const;

  // ~40% of users have a social auth
  for (const u of users) {
    if (Math.random() > 0.6) {
      auths.push({
        userId: u.id,
        provider: pick([...providers]),
        providerId: `${pick([...providers])}_${crypto.randomUUID()}`,
      });
    }
  }

  if (auths.length > 0) {
    await db.insert(schema.userSocialAuths).values(auths);
  }
  console.log(`    → ${auths.length} social auths`);
}

async function seedTaxonomies() {
  console.log("  Seeding taxonomies...");

  const categoryRecords = TAXONOMY_CATEGORIES.map((c) => ({
    name: c.name,
    slug: slug(c.name),
    type: c.type,
    description: `Articles and discussions about ${c.name.toLowerCase()}.`,
  }));

  const categories = await db.insert(schema.taxonomies).values(categoryRecords).returning();

  const tagRecords = TAXONOMY_TAGS.map((t) => ({
    name: t.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
    slug: t,
    type: "tag" as const,
  }));

  const tags = await db.insert(schema.taxonomies).values(tagRecords).returning();

  console.log(`    → ${categories.length} categories, ${tags.length} tags`);
  return { categories, tags };
}

async function seedPosts(users: { id: number }[]) {
  console.log("  Seeding posts...");

  const authors = users.slice(0, 10); // first 10 users write posts
  const statuses = ["published", "published", "published", "draft", "archived"] as const;
  const types = ["article", "article", "news", "podcast", "video"] as const;

  const postRecords = POST_TITLES.map((title, i) => {
    const author = authors[i % authors.length];
    const isPublished = i < 15;

    return {
      authorId: author.id,
      title,
      slug: slug(title),
      content: pickN(PARAGRAPHS, randomInt(2, 4)).join("\n\n"),
      excerpt: PARAGRAPHS[i % PARAGRAPHS.length].substring(0, 120) + "...",
      status: isPublished ? ("published" as const) : pick([...statuses]),
      type: pick([...types]),
      commentEnabled: Math.random() > 0.1,
      estimatedReadingMinutes: randomInt(3, 15),
      viewCount: randomInt(10, 5000),
      publishedAt: isPublished ? daysAgo(randomInt(1, 90)) : null,
    };
  });

  const posts = await db.insert(schema.posts).values(postRecords).returning();
  console.log(`    → ${posts.length} posts`);
  return posts;
}

async function seedPostAuthors(posts: { id: number; authorId: number }[], users: { id: number }[]) {
  console.log("  Seeding post co-authors...");

  const coAuthorRecords: (typeof schema.postAuthors.$inferInsert)[] = [];

  // ~30% of posts get a co-author
  for (const post of posts) {
    if (Math.random() > 0.7) {
      const coAuthor = users.find((u) => u.id !== post.authorId);
      if (coAuthor) {
        coAuthorRecords.push({
          postId: post.id,
          userId: coAuthor.id,
          role: pick(["co-author", "contributor", "researcher"]),
          displayOrder: 1,
        });
      }
    }
  }

  if (coAuthorRecords.length > 0) {
    await db.insert(schema.postAuthors).values(coAuthorRecords);
  }
  console.log(`    → ${coAuthorRecords.length} co-authorships`);
}

async function seedPostTaxonomies(posts: { id: number }[], categories: { id: number }[], tags: { id: number }[]) {
  console.log("  Seeding post taxonomies...");

  const records: (typeof schema.postTaxonomies.$inferInsert)[] = [];

  for (const post of posts) {
    // 1 category per post
    records.push({
      postId: post.id,
      taxonomyId: pick(categories).id,
      isPrimary: true,
    });

    // 1-3 tags per post
    const postTags = pickN(tags, randomInt(1, 3));
    for (const tag of postTags) {
      records.push({
        postId: post.id,
        taxonomyId: tag.id,
        isPrimary: false,
      });
    }
  }

  await db.insert(schema.postTaxonomies).values(records);
  console.log(`    → ${records.length} post-taxonomy links`);
}

async function seedComments(posts: { id: number }[], users: { id: number }[]) {
  console.log("  Seeding comments...");

  const commentRecords: (typeof schema.comments.$inferInsert)[] = [];
  const publishedPosts = posts.slice(0, 15);

  // Top-level comments
  for (const post of publishedPosts) {
    const numComments = randomInt(1, 5);
    for (let i = 0; i < numComments; i++) {
      commentRecords.push({
        postId: post.id,
        authorId: pick(users).id,
        content: pick(COMMENTS_POOL),
        status: pick(["approved", "approved", "approved", "pending"]) as "approved" | "pending",
      });
    }
  }

  const topLevel = await db.insert(schema.comments).values(commentRecords).returning();

  // Some replies (nested comments)
  const replyRecords: (typeof schema.comments.$inferInsert)[] = [];
  for (const comment of topLevel.slice(0, 15)) {
    if (Math.random() > 0.5) {
      replyRecords.push({
        postId: comment.postId,
        authorId: pick(users).id,
        parentId: comment.id,
        content: pick(COMMENTS_POOL),
        status: "approved",
      });
    }
  }

  let replies: { id: number }[] = [];
  if (replyRecords.length > 0) {
    replies = await db.insert(schema.comments).values(replyRecords).returning();
  }

  const allComments = [...topLevel, ...replies];
  console.log(`    → ${allComments.length} comments (${replies.length} replies)`);
  return allComments;
}

async function seedCommentClassifications(comments: { id: number }[], users: { id: number }[]) {
  console.log("  Seeding comment classifications...");

  const classifications = ["best", "good", "average", "spamming", "vulgar"] as const;
  const sentiments = ["positive", "negative", "neutral"] as const;
  const records: (typeof schema.commentClassifications.$inferInsert)[] = [];

  // Classify ~40% of comments
  for (const comment of comments) {
    if (Math.random() > 0.6) {
      records.push({
        commentId: comment.id,
        classifiedById: pick(users.slice(0, 3)).id, // mods/admins classify
        classification: pick([...classifications]),
        sentiment: pick([...sentiments]),
      });
    }
  }

  if (records.length > 0) {
    await db.insert(schema.commentClassifications).values(records);
  }
  console.log(`    → ${records.length} classifications`);
}

async function seedSocialInteractions(posts: { id: number }[], comments: { id: number }[], users: { id: number }[]) {
  console.log("  Seeding social interactions...");

  // Follows
  const followRecords: (typeof schema.follows.$inferInsert)[] = [];
  const followPairs = new Set<string>();

  for (let i = 0; i < 40; i++) {
    const follower = pick(users);
    const following = pick(users);
    const key = `${follower.id}-${following.id}`;

    if (follower.id !== following.id && !followPairs.has(key)) {
      followPairs.add(key);
      followRecords.push({
        followerId: follower.id,
        followingId: following.id,
        status: "follow",
      });
    }
  }

  if (followRecords.length > 0) {
    await db.insert(schema.follows).values(followRecords);
  }

  // Friend requests
  const friendRecords: (typeof schema.friendRequests.$inferInsert)[] = [];
  const friendPairs = new Set<string>();

  for (let i = 0; i < 15; i++) {
    const requester = pick(users);
    const requested = pick(users);
    const key = `${requester.id}-${requested.id}`;

    if (requester.id !== requested.id && !friendPairs.has(key)) {
      friendPairs.add(key);
      friendRecords.push({
        requesterId: requester.id,
        requestedId: requested.id,
        status: pick(["pending", "accepted", "accepted", "rejected"]) as any,
      });
    }
  }

  if (friendRecords.length > 0) {
    await db.insert(schema.friendRequests).values(friendRecords);
  }

  // Post reactions
  const postReactionRecords: (typeof schema.postReactions.$inferInsert)[] = [];
  const reactionPairs = new Set<string>();

  for (const post of posts.slice(0, 15)) {
    const numReactions = randomInt(2, 8);
    for (let i = 0; i < numReactions; i++) {
      const user = pick(users);
      const key = `${post.id}-${user.id}`;

      if (!reactionPairs.has(key)) {
        reactionPairs.add(key);
        postReactionRecords.push({
          postId: post.id,
          userId: user.id,
          reaction: pick(["like", "like", "like", "dislike"]) as "like" | "dislike",
        });
      }
    }
  }

  if (postReactionRecords.length > 0) {
    await db.insert(schema.postReactions).values(postReactionRecords);
  }

  // Comment reactions
  const commentReactionRecords: (typeof schema.commentReactions.$inferInsert)[] = [];
  const commentReactionPairs = new Set<string>();

  for (const comment of comments.slice(0, 20)) {
    if (Math.random() > 0.5) {
      const user = pick(users);
      const key = `${comment.id}-${user.id}`;

      if (!commentReactionPairs.has(key)) {
        commentReactionPairs.add(key);
        commentReactionRecords.push({
          commentId: comment.id,
          userId: user.id,
          reaction: pick(["like", "dislike"]) as "like" | "dislike",
        });
      }
    }
  }

  if (commentReactionRecords.length > 0) {
    await db.insert(schema.commentReactions).values(commentReactionRecords);
  }

  // Post emojis
  const emojiRecords: (typeof schema.postEmojis.$inferInsert)[] = [];
  const emojiValues = ["🔥", "💡", "🎯", "🤔", "👏", "❤️"];
  const emojiPairs = new Set<string>();

  for (const post of posts.slice(0, 10)) {
    const numEmojis = randomInt(1, 4);
    for (let i = 0; i < numEmojis; i++) {
      const user = pick(users);
      const emoji = pick(emojiValues);
      const key = `${post.id}-${user.id}-${emoji}`;

      if (!emojiPairs.has(key)) {
        emojiPairs.add(key);
        emojiRecords.push({
          postId: post.id,
          userId: user.id,
          emojiValue: emoji,
          sentiment: ["🔥", "💡", "👏", "❤️"].includes(emoji) ? "positive" : "negative",
        });
      }
    }
  }

  if (emojiRecords.length > 0) {
    await db.insert(schema.postEmojis).values(emojiRecords);
  }

  // Bookmarks
  const bookmarkRecords: (typeof schema.bookmarks.$inferInsert)[] = [];
  const bookmarkPairs = new Set<string>();

  for (let i = 0; i < 30; i++) {
    const user = pick(users);
    const post = pick(posts);
    const key = `${user.id}-${post.id}`;

    if (!bookmarkPairs.has(key)) {
      bookmarkPairs.add(key);
      bookmarkRecords.push({ postId: post.id, userId: user.id });
    }
  }

  if (bookmarkRecords.length > 0) {
    await db.insert(schema.bookmarks).values(bookmarkRecords);
  }

  // Shares
  const shareRecords: (typeof schema.shares.$inferInsert)[] = [];
  for (let i = 0; i < 20; i++) {
    shareRecords.push({
      postId: pick(posts).id,
      userId: pick(users).id,
      platform: pick(["twitter", "linkedin", "facebook", "copy_link"]),
    });
  }

  await db.insert(schema.shares).values(shareRecords);

  // People's choice votes
  const pcRecords: (typeof schema.peoplesChoiceVotes.$inferInsert)[] = [];
  const pcPairs = new Set<string>();

  for (let i = 0; i < 25; i++) {
    const user = pick(users);
    const post = pick(posts.slice(0, 10));
    const key = `${user.id}-${post.id}`;

    if (!pcPairs.has(key)) {
      pcPairs.add(key);
      pcRecords.push({ postId: post.id, userId: user.id });
    }
  }

  if (pcRecords.length > 0) {
    await db.insert(schema.peoplesChoiceVotes).values(pcRecords);
  }

  console.log(`    → ${followRecords.length} follows, ${friendRecords.length} friend requests`);
  console.log(`    → ${postReactionRecords.length} post reactions, ${commentReactionRecords.length} comment reactions`);
  console.log(
    `    → ${emojiRecords.length} emojis, ${bookmarkRecords.length} bookmarks, ${shareRecords.length} shares`,
  );
}

async function seedPolls(posts: { id: number }[], users: { id: number }[]) {
  console.log("  Seeding polls...");

  const pollData = [
    {
      title: "Best AI Framework 2025",
      question: "Which AI framework do you use most?",
      options: ["PyTorch", "TensorFlow", "JAX", "MLX"],
    },
    {
      title: "Preferred Consensus Mechanism",
      question: "What's the most promising consensus mechanism?",
      options: ["Proof of Stake", "Proof of Work", "DAG-based", "Proof of Authority"],
    },
    {
      title: "Content Format Preference",
      question: "What content format do you prefer?",
      options: ["Long-form articles", "Short news", "Podcasts", "Video essays"],
    },
  ];

  for (let i = 0; i < pollData.length; i++) {
    const data = pollData[i];
    const [poll] = await db
      .insert(schema.polls)
      .values({
        postId: posts[i]?.id ?? null,
        createdById: users[0].id,
        title: data.title,
        question: data.question,
        type: "single_choice",
        isActive: true,
        startsAt: daysAgo(30),
        endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })
      .returning();

    const options = await db
      .insert(schema.pollOptions)
      .values(
        data.options.map((text, order) => ({
          pollId: poll.id,
          text,
          displayOrder: order + 1,
        })),
      )
      .returning();

    // Random votes
    const voters = pickN(users, randomInt(5, 12));
    const voteRecords = voters.map((u) => ({
      pollId: poll.id,
      optionId: pick(options).id,
      userId: u.id,
    }));

    await db.insert(schema.pollVotes).values(voteRecords);
  }

  // Poll categories
  await db.insert(schema.pollCategories).values([
    { title: "Technology", description: "Tech-related polls" },
    { title: "Community", description: "Community governance polls" },
  ]);

  console.log(`    → ${pollData.length} polls with options and votes`);
}

async function seedFaqs() {
  console.log("  Seeding FAQs...");

  const [category] = await db
    .insert(schema.faqCategories)
    .values({
      name: "Getting Started",
      slug: "getting-started",
      displayOrder: 0,
    })
    .returning();

  const [advancedCat] = await db
    .insert(schema.faqCategories)
    .values({
      name: "Advanced Features",
      slug: "advanced-features",
      parentId: category.id,
      displayOrder: 1,
    })
    .returning();

  const questions = FAQ_ITEMS.map((item, i) => ({
    categoryId: i < 4 ? category.id : advancedCat.id,
    question: item.q,
    answer: item.a,
    displayOrder: i,
    isPublished: true,
  }));

  await db.insert(schema.faqQuestions).values(questions);
  console.log(`    → 2 FAQ categories, ${questions.length} questions`);
}

async function seedNotifications(users: { id: number }[]) {
  console.log("  Seeding notifications...");

  const types = ["new_follower", "post_reaction", "comment_reply", "mention", "system_update"];
  const records: (typeof schema.notifications.$inferInsert)[] = [];

  for (const user of users.slice(0, 10)) {
    const numNotifs = randomInt(2, 6);
    for (let i = 0; i < numNotifs; i++) {
      const type = pick(types);
      records.push({
        userId: user.id,
        actorId: pick(users.filter((u) => u.id !== user.id)).id,
        type,
        message: `You have a new ${type.replace(/_/g, " ")}`,
        status: pick(["unread", "unread", "read"]) as "unread" | "read",
        createdAt: daysAgo(randomInt(0, 14)),
      });
    }
  }

  await db.insert(schema.notifications).values(records);
  console.log(`    → ${records.length} notifications`);
}

async function seedReputations(posts: { id: number }[], users: { id: number }[]) {
  console.log("  Seeding interactions & reading sessions...");

  const modules = ["post", "comment", "social"];
  const types = ["like", "comment", "share", "read", "vote"];
  const interactionRecords: (typeof schema.interactions.$inferInsert)[] = [];

  for (let i = 0; i < 80; i++) {
    interactionRecords.push({
      userId: pick(users).id,
      module: pick(modules),
      type: pick(types),
      targetId: pick(posts).id,
      targetType: "post",
      interactionWeight: randomDecimal(0.1, 2.0),
      value: randomDecimal(0.01, 1.0),
      interactorReward: randomDecimal(0.001, 0.5),
      createdAt: daysAgo(randomInt(0, 60)),
    });
  }

  await db.insert(schema.interactions).values(interactionRecords);

  // Reading sessions
  const sessionRecords: (typeof schema.readingSessions.$inferInsert)[] = [];
  for (let i = 0; i < 50; i++) {
    const totalTime = randomInt(60, 600);
    const spentTime = randomInt(30, totalTime);

    sessionRecords.push({
      postId: pick(posts).id,
      userId: pick(users).id,
      status: pick(["completed", "completed", "in_progress", "abandoned"]),
      totalTimeToReadSec: totalTime,
      userSpentTimeSec: spentTime,
      completionRatio: parseFloat((spentTime / totalTime).toFixed(2)),
      createdAt: daysAgo(randomInt(0, 30)),
    });
  }

  await db.insert(schema.readingSessions).values(sessionRecords);
  console.log(`    → ${interactionRecords.length} interactions, ${sessionRecords.length} reading sessions`);
}

async function seedContentSources(users: { id: number }[]) {
  console.log("  Seeding content sources...");

  const sources = [
    {
      name: "ArXiv AI Papers",
      url: "https://arxiv.org/list/cs.AI/recent",
      type: "rss",
    },
    {
      name: "Hacker News",
      url: "https://news.ycombinator.com/rss",
      type: "rss",
    },
    {
      name: "AI Blog Aggregator",
      url: "https://example.com/ai-blogs",
      type: "api",
    },
  ];

  const records = sources.map((s, i) => ({
    userId: users[i % users.length].id,
    name: s.name,
    url: s.url,
    type: s.type,
    isActive: true,
  }));

  await db.insert(schema.contentSources).values(records);
  console.log(`    → ${records.length} content sources`);
}

async function seedMailings(users: { id: number }[]) {
  console.log("  Seeding mailing data...");

  // Subscribers
  const subscribers = users.slice(0, 12).map((u) => ({
    email: `user_${u.id}@mindplex.local`,
    listType: pick(["weekly_digest", "announcements", "product_updates"]),
    userId: u.id,
    isActive: true,
  }));

  await db.insert(schema.mailingListSubscribers).values(subscribers);

  // Contact submissions
  const contacts = [
    {
      firstName: "Test",
      lastName: "User",
      email: "test@example.com",
      message: "Love the platform! When is the mobile app coming?",
    },
    {
      firstName: "Bug",
      lastName: "Reporter",
      email: "bugs@example.com",
      message: "Found an issue with the comment threading on mobile Safari.",
    },
  ];

  await db.insert(schema.contactSubmissions).values(contacts);

  // Email campaign
  const [campaign] = await db
    .insert(schema.emailCampaigns)
    .values({
      emailType: "weekly_digest",
      templateName: "weekly-digest-v2",
      status: "sent",
      sentById: users[0].id,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  const deliveries = users.slice(0, 8).map((u) => ({
    campaignId: campaign.id,
    recipientEmail: `user_${u.id}@mindplex.local`,
    status: pick(["delivered", "delivered", "delivered", "bounced"]) as any,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  await db.insert(schema.emailDeliveries).values(deliveries);
  console.log(
    `    → ${subscribers.length} subscribers, ${contacts.length} contacts, 1 campaign with ${deliveries.length} deliveries`,
  );
}

async function seedMedia(users: { id: number }[]) {
  console.log("  Seeding media...");

  const records = Array.from({ length: 10 }, (_, i) => ({
    uploaderId: pick(users).id,
    url: `https://placehold.co/800x${pick([400, 450, 500, 600])}?text=Article+Image+${i + 1}`,
    altText: `Sample image ${i + 1}`,
    mimeType: "image/png",
    sizeBytes: randomInt(50000, 500000),
    width: 800,
    height: pick([400, 450, 500, 600]),
  }));

  await db.insert(schema.media).values(records);
  console.log(`    → ${records.length} media items`);
}

// ─── Main ───────────────────────────────────────────────────────

async function seed() {
  console.log("\n🌱 Starting seed...\n");
  const start = performance.now();

  // Truncate all tables (CASCADE handles FK constraints)
  console.log("  Truncating tables...");
  await db.execute(sql`
        TRUNCATE TABLE
            users,
            user_profiles,
            user_preferences,
            user_notification_settings,
            user_social_auths,
            user_wallets,
            user_interests,
            user_educations,
            refresh_tokens,
            activation_tokens,
            posts,
            post_authors,
            post_taxonomies,
            media,
            taxonomies,
            comments,
            comment_classifications,
            comment_reactions,
            follows,
            friend_requests,
            post_reactions,
            post_emojis,
            bookmarks,
            shares,
            peoples_choice_votes,
            interactions,
            reading_sessions,
            polls,
            poll_categories,
            poll_options,
            poll_votes,
            faq_categories,
            faq_questions,
            content_sources,
            content_source_reactions,
            notifications,
            mailing_list_subscribers,
            contact_submissions,
            email_campaigns,
            email_deliveries
        RESTART IDENTITY CASCADE
    `);

  // Seed in dependency order
  const users = await seedUsers();
  await seedUserProfiles(users);
  await seedUserPreferences(users);
  await seedNotificationSettings(users);
  await seedUserInterestsAndEducation(users);
  await seedWallets(users);
  await seedSocialAuths(users);

  const { categories, tags } = await seedTaxonomies();
  const posts = await seedPosts(users);
  await seedPostAuthors(posts, users);
  await seedPostTaxonomies(posts, categories, tags);
  await seedMedia(users);

  const comments = await seedComments(posts, users);
  await seedCommentClassifications(comments, users);
  await seedSocialInteractions(posts, comments, users);
  await seedPolls(posts, users);
  await seedReputations(posts, users);

  await seedFaqs();
  await seedNotifications(users);
  await seedContentSources(users);
  await seedMailings(users);

  const elapsed = ((performance.now() - start) / 1000).toFixed(2);

  console.log(`\n✅ Seed complete in ${elapsed}s`);
  console.log('\n📋 Test accounts (all passwords: "password123"):');
  console.log("   admin@mindplex.local        → Argon2id (already migrated)");
  console.log("   mod@mindplex.local           → $wp$2y$ (bcrypt, will migrate on login)");
  console.log("   editor@mindplex.local        → $P$B    (PHPass, will migrate on login)");
  console.log("   Regular users rotate through all 3 hash types\n");

  await pool.end();
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  pool.end();
  process.exit(1);
});
