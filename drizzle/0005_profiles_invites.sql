CREATE TABLE `invites` (
	`email` text PRIMARY KEY NOT NULL,
	`invited_by` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `users` ADD `avatar_file` text;--> statement-breakpoint
ALTER TABLE `users` ADD `profile_done` integer DEFAULT false NOT NULL;