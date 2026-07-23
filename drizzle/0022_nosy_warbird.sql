CREATE TABLE "daily_mission_log" (
	"user_id" uuid NOT NULL,
	"mission_date" text NOT NULL,
	"mission_key" text NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL,
	"reward_item_id" integer,
	CONSTRAINT "daily_mission_log_user_id_mission_date_mission_key_pk" PRIMARY KEY("user_id","mission_date","mission_key")
);
--> statement-breakpoint
CREATE TABLE "player_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"item_type" text NOT NULL,
	"label" text NOT NULL,
	"earned_from_mission_key" text,
	"earned_at" timestamp DEFAULT now() NOT NULL,
	"used_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "player_state" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"current_streak_days" integer DEFAULT 0 NOT NULL,
	"longest_streak_days" integer DEFAULT 0 NOT NULL,
	"last_activity_date" text,
	"lockdown_grace_until" timestamp
);
--> statement-breakpoint
ALTER TABLE "mastery" ADD COLUMN "unlock_override_until" timestamp;--> statement-breakpoint
ALTER TABLE "daily_mission_log" ADD CONSTRAINT "daily_mission_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_mission_log" ADD CONSTRAINT "daily_mission_log_reward_item_id_player_items_id_fk" FOREIGN KEY ("reward_item_id") REFERENCES "public"."player_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_items" ADD CONSTRAINT "player_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_state" ADD CONSTRAINT "player_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;