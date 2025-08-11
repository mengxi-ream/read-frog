CREATE TYPE "public"."lang_code_iso_639_3" AS ENUM('eng', 'cmn', 'cmn-Hant', 'yue', 'spa', 'rus', 'arb', 'ben', 'hin', 'por', 'ind', 'jpn', 'fra', 'deu', 'jav', 'kor', 'tel', 'vie', 'mar', 'ita', 'tam', 'tur', 'urd', 'guj', 'pol', 'ukr', 'kan', 'mai', 'mal', 'pes', 'mya', 'swh', 'sun', 'ron', 'pan', 'bho', 'amh', 'hau', 'fuv', 'bos', 'hrv', 'nld', 'srp', 'tha', 'ckb', 'yor', 'uzn', 'zlm', 'ibo', 'npi', 'ceb', 'skr', 'tgl', 'hun', 'azj', 'sin', 'koi', 'ell', 'ces', 'mag', 'run', 'bel', 'plt', 'qug', 'mad', 'nya', 'zyb', 'pbu', 'kin', 'zul', 'bul', 'swe', 'lin', 'som', 'hms', 'hnj', 'ilo', 'kaz');--> statement-breakpoint
CREATE TABLE "vocabulary" (
	"id" text PRIMARY KEY NOT NULL,
	"original_text" text NOT NULL,
	"translation" text NOT NULL,
	"source_language_iso_639_3" "lang_code_iso_639_3" NOT NULL,
	"target_language_iso_639_3" "lang_code_iso_639_3" NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vocabulary" ADD CONSTRAINT "vocabulary_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;