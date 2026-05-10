CREATE TABLE "plugin_activation_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plugin_activation_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "plugin_refresh_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" varchar(255) NOT NULL,
	"family_id" varchar(255) NOT NULL,
	"is_revoked" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"family_expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plugin_refresh_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "plugin_user_notification_settings" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"notify_publications" boolean DEFAULT true,
	"notify_follower" boolean DEFAULT true,
	"notify_interaction" boolean DEFAULT true,
	"notify_weekly" boolean DEFAULT true,
	"notify_updates" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "plugin_user_preferences" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"theme" varchar(20) DEFAULT 'light',
	"privacy_age" varchar(20) DEFAULT 'private',
	"privacy_gender" varchar(20) DEFAULT 'private',
	"privacy_education" varchar(20) DEFAULT 'private'
);
--> statement-breakpoint
CREATE TABLE "plugin_user_profiles" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"avatar_url" text,
	"bio" text,
	"date_of_birth" date,
	"gender" varchar(50),
	"education" varchar(255),
	"social_media" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "plugin_user_social_auths" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plugin_user_social_auths_provider_id_unique" UNIQUE("provider_id"),
	CONSTRAINT "plugin_user_social_auths_user_provider_idx" UNIQUE("user_id","provider")
);
--> statement-breakpoint
CREATE TABLE "plugin_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(60) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255),
	"role" varchar(20) DEFAULT 'user' NOT NULL,
	"is_activated" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plugin_users_username_unique" UNIQUE("username"),
	CONSTRAINT "plugin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "activation_tokens" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "refresh_tokens" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_notification_settings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_preferences" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_profiles" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_social_auths" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "activation_tokens" CASCADE;--> statement-breakpoint
DROP TABLE "refresh_tokens" CASCADE;--> statement-breakpoint
DROP TABLE "user_notification_settings" CASCADE;--> statement-breakpoint
DROP TABLE "user_preferences" CASCADE;--> statement-breakpoint
DROP TABLE "user_profiles" CASCADE;--> statement-breakpoint
DROP TABLE "user_social_auths" CASCADE;--> statement-breakpoint
DROP TABLE "users" CASCADE;--> statement-breakpoint
ALTER TABLE "media" DROP CONSTRAINT "media_uploader_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "post_authors" DROP CONSTRAINT "post_authors_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "posts" DROP CONSTRAINT "posts_author_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "comment_classifications" DROP CONSTRAINT "comment_classifications_classified_by_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "comments" DROP CONSTRAINT "comments_author_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "bookmarks" DROP CONSTRAINT "bookmarks_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "comment_reactions" DROP CONSTRAINT "comment_reactions_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "follows" DROP CONSTRAINT "follows_follower_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "follows" DROP CONSTRAINT "follows_following_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "friend_requests" DROP CONSTRAINT "friend_requests_requester_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "friend_requests" DROP CONSTRAINT "friend_requests_requested_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "peoples_choice_votes" DROP CONSTRAINT "peoples_choice_votes_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "post_emojis" DROP CONSTRAINT "post_emojis_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "post_reactions" DROP CONSTRAINT "post_reactions_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "shares" DROP CONSTRAINT "shares_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "interactions" DROP CONSTRAINT "interactions_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "reading_sessions" DROP CONSTRAINT "reading_sessions_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "user_wallets" DROP CONSTRAINT "user_wallets_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_actor_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "poll_votes" DROP CONSTRAINT "poll_votes_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "polls" DROP CONSTRAINT "polls_created_by_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "content_source_reactions" DROP CONSTRAINT "content_source_reactions_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "content_sources" DROP CONSTRAINT "content_sources_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "contact_submissions" DROP CONSTRAINT "contact_submissions_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "email_campaigns" DROP CONSTRAINT "email_campaigns_sent_by_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "mailing_list_subscribers" DROP CONSTRAINT "mailing_list_subscribers_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "user_educations" DROP CONSTRAINT "user_educations_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "user_interests" DROP CONSTRAINT "user_interests_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "plugin_activation_tokens" ADD CONSTRAINT "plugin_activation_tokens_user_id_plugin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."plugin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_refresh_tokens" ADD CONSTRAINT "plugin_refresh_tokens_user_id_plugin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."plugin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_user_notification_settings" ADD CONSTRAINT "plugin_user_notification_settings_user_id_plugin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."plugin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_user_preferences" ADD CONSTRAINT "plugin_user_preferences_user_id_plugin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."plugin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_user_profiles" ADD CONSTRAINT "plugin_user_profiles_user_id_plugin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."plugin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_user_social_auths" ADD CONSTRAINT "plugin_user_social_auths_user_id_plugin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."plugin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_uploader_id_plugin_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."plugin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_authors" ADD CONSTRAINT "post_authors_user_id_plugin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."plugin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_plugin_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."plugin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_classifications" ADD CONSTRAINT "comment_classifications_classified_by_id_plugin_users_id_fk" FOREIGN KEY ("classified_by_id") REFERENCES "public"."plugin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_plugin_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."plugin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_plugin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."plugin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_user_id_plugin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."plugin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_plugin_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."plugin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_following_id_plugin_users_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."plugin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_requester_id_plugin_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."plugin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_requested_id_plugin_users_id_fk" FOREIGN KEY ("requested_id") REFERENCES "public"."plugin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peoples_choice_votes" ADD CONSTRAINT "peoples_choice_votes_user_id_plugin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."plugin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_emojis" ADD CONSTRAINT "post_emojis_user_id_plugin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."plugin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_user_id_plugin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."plugin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shares" ADD CONSTRAINT "shares_user_id_plugin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."plugin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_user_id_plugin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."plugin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_sessions" ADD CONSTRAINT "reading_sessions_user_id_plugin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."plugin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_wallets" ADD CONSTRAINT "user_wallets_user_id_plugin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."plugin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_plugin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."plugin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_plugin_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."plugin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_user_id_plugin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."plugin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_created_by_id_plugin_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."plugin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_source_reactions" ADD CONSTRAINT "content_source_reactions_user_id_plugin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."plugin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_sources" ADD CONSTRAINT "content_sources_user_id_plugin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."plugin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_submissions" ADD CONSTRAINT "contact_submissions_user_id_plugin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."plugin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_sent_by_id_plugin_users_id_fk" FOREIGN KEY ("sent_by_id") REFERENCES "public"."plugin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mailing_list_subscribers" ADD CONSTRAINT "mailing_list_subscribers_user_id_plugin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."plugin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_educations" ADD CONSTRAINT "user_educations_user_id_plugin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."plugin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_user_id_plugin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."plugin_users"("id") ON DELETE cascade ON UPDATE no action;