CREATE TABLE "player_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"website_url" text DEFAULT '' NOT NULL,
	"github_url" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "player_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "player_profiles" ADD CONSTRAINT "player_profiles_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "solve_owner_history" ON "solves" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "solve_first_blood" ON "solves" USING btree ("challenge_id","created_at","id");