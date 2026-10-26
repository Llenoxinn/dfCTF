CREATE TABLE "competition_challenges" (
	"competition_id" text NOT NULL,
	"challenge_id" text NOT NULL,
	"points" integer NOT NULL,
	CONSTRAINT "competition_challenges_competition_id_challenge_id_pk" PRIMARY KEY("competition_id","challenge_id"),
	CONSTRAINT "competition_points_positive" CHECK ("competition_challenges"."points" > 0)
);
--> statement-breakpoint
CREATE TABLE "competition_registrations" (
	"competition_id" text NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competition_registrations_competition_id_user_id_pk" PRIMARY KEY("competition_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "competition_solves" (
	"id" text PRIMARY KEY NOT NULL,
	"competition_id" text NOT NULL,
	"user_id" text NOT NULL,
	"challenge_id" text NOT NULL,
	"points" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competition_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"competition_id" text NOT NULL,
	"user_id" text NOT NULL,
	"challenge_id" text NOT NULL,
	"digest" text NOT NULL,
	"correct" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitions" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"rules" text DEFAULT '' NOT NULL,
	"platform" text NOT NULL,
	"external_url" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competition_dates" CHECK ("competitions"."ends_at" > "competitions"."starts_at")
);
--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "visibility" text DEFAULT 'practice' NOT NULL;--> statement-breakpoint
ALTER TABLE "competition_challenges" ADD CONSTRAINT "competition_challenges_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_challenges" ADD CONSTRAINT "competition_challenges_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_registrations" ADD CONSTRAINT "competition_registrations_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_registrations" ADD CONSTRAINT "competition_registrations_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_solves" ADD CONSTRAINT "competition_solves_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_solves" ADD CONSTRAINT "competition_solves_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_solves" ADD CONSTRAINT "competition_solves_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_submissions" ADD CONSTRAINT "competition_submissions_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_submissions" ADD CONSTRAINT "competition_submissions_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_submissions" ADD CONSTRAINT "competition_submissions_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_created_by_auth_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."auth_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "competition_challenge_exclusive" ON "competition_challenges" USING btree ("challenge_id");--> statement-breakpoint
CREATE UNIQUE INDEX "competition_solve_once" ON "competition_solves" USING btree ("competition_id","user_id","challenge_id");--> statement-breakpoint
CREATE INDEX "competition_solve_order" ON "competition_solves" USING btree ("competition_id","challenge_id","created_at","id");--> statement-breakpoint
CREATE INDEX "competition_attempt_lookup" ON "competition_submissions" USING btree ("competition_id","user_id","challenge_id");