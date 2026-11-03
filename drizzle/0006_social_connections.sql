CREATE TABLE "friendships" (
	"low_user_id" text NOT NULL,
	"high_user_id" text NOT NULL,
	"requested_by" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friendships_low_user_id_high_user_id_pk" PRIMARY KEY("low_user_id","high_user_id"),
	CONSTRAINT "friendship_pair" CHECK ("friendships"."low_user_id" collate "C" < "friendships"."high_user_id" collate "C"),
	CONSTRAINT "friendship_requester" CHECK ("friendships"."requested_by" in ("friendships"."low_user_id", "friendships"."high_user_id")),
	CONSTRAINT "friendship_status" CHECK ("friendships"."status" in ('pending','accepted','declined'))
);
--> statement-breakpoint
ALTER TABLE "friendships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "player_profiles" ADD COLUMN "share_profile" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_low_user_id_auth_user_id_fk" FOREIGN KEY ("low_user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_high_user_id_auth_user_id_fk" FOREIGN KEY ("high_user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requested_by_auth_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "friendships_recipient" ON "friendships" USING btree ("high_user_id");--> statement-breakpoint
CREATE INDEX "auth_user_player_directory" ON "auth_user" USING btree (lower("codename") collate "C");