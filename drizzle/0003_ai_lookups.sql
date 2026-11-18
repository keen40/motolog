CREATE TABLE `ai_lookups` (
	`id` text PRIMARY KEY NOT NULL,
	`model_id` text,
	`user_id` text,
	`input` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`apply` integer DEFAULT true NOT NULL,
	`result` text,
	`sources` text,
	`error` text,
	`ai_model` text,
	`input_tokens` integer,
	`output_tokens` integer,
	`search_calls` integer,
	`cost_usd` real,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`finished_at` text,
	FOREIGN KEY (`model_id`) REFERENCES `vehicle_models`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `ai_lookups_created` ON `ai_lookups` (`created_at`);--> statement-breakpoint
ALTER TABLE `vehicle_models` ADD `data_origin` text DEFAULT 'seed' NOT NULL;