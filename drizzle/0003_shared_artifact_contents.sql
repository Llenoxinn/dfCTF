CREATE TABLE "artifact_contents" (
	"artifact_id" text PRIMARY KEY NOT NULL,
	"content" "bytea" NOT NULL,
	CONSTRAINT "artifact_contents_size" CHECK (octet_length(content) BETWEEN 1 AND 10485760)
);
--> statement-breakpoint
ALTER TABLE "artifact_contents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "artifact_contents" ADD CONSTRAINT "artifact_contents_artifact_id_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE cascade ON UPDATE no action;