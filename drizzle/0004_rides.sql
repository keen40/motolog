CREATE TABLE `rides` (
	`id` text PRIMARY KEY NOT NULL,
	`vehicle_id` text NOT NULL,
	`author_id` text,
	`ride_date` text NOT NULL,
	`duration_h` real NOT NULL,
	`track` text,
	`surface` text,
	`tuning_sheet_id` text,
	`fuel_l` real,
	`notes` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`tuning_sheet_id`) REFERENCES `tuning_sheets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `rides_vehicle` ON `rides` (`vehicle_id`,`ride_date`);