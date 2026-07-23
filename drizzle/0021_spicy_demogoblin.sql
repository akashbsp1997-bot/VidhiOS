CREATE TABLE "question_model_answers" (
	"question_source" text NOT NULL,
	"question_ref_id" text NOT NULL,
	"model_answer" text NOT NULL,
	"key_points" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "question_model_answers_question_source_question_ref_id_pk" PRIMARY KEY("question_source","question_ref_id")
);
