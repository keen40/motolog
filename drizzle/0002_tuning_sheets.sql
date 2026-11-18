CREATE TABLE `tuning_sheets` (
	`id` text PRIMARY KEY NOT NULL,
	`vehicle_id` text NOT NULL,
	`author_id` text,
	`title` text NOT NULL,
	`sheet_date` text,
	`engine_hours` real,
	`track` text,
	`surface` text,
	`weather` text,
	`temp_c` real,
	`altitude_m` real,
	`settings` text DEFAULT '{}' NOT NULL,
	`rating` integer,
	`notes` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `tuning_sheets_vehicle` ON `tuning_sheets` (`vehicle_id`,`sheet_date`);--> statement-breakpoint
ALTER TABLE `vehicle_models` ADD `stock_setup` text;