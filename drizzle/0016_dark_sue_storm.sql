CREATE TABLE "mock_test_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"mock_test_id" integer NOT NULL,
	"order_index" integer NOT NULL,
	"subtopic_id" text NOT NULL,
	"question_source" text NOT NULL,
	"question_ref_id" text NOT NULL,
	"question_text" text NOT NULL,
	"marks" integer NOT NULL,
	"answer_text" text,
	"score" integer,
	"feedback" jsonb
);
--> statement-breakpoint
CREATE TABLE "mock_tests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"subject_id" text NOT NULL,
	"size" text NOT NULL,
	"total_marks" integer NOT NULL,
	"duration_minutes" integer NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"submitted_at" timestamp,
	"total_score" integer
);
--> statement-breakpoint
ALTER TABLE "mock_test_questions" ADD CONSTRAINT "mock_test_questions_mock_test_id_mock_tests_id_fk" FOREIGN KEY ("mock_test_id") REFERENCES "public"."mock_tests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_test_questions" ADD CONSTRAINT "mock_test_questions_subtopic_id_subtopics_id_fk" FOREIGN KEY ("subtopic_id") REFERENCES "public"."subtopics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_tests" ADD CONSTRAINT "mock_tests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_tests" ADD CONSTRAINT "mock_tests_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;