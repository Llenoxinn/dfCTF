CREATE TABLE "feedback_receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"digest" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feedback_receipts" ENABLE ROW LEVEL SECURITY;