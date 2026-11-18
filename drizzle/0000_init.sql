CREATE TABLE `fitment_parts` (
	`id` text PRIMARY KEY NOT NULL,
	`model_id` text NOT NULL,
	`seed_key` text,
	`zone` text NOT NULL,
	`category` text NOT NULL,
	`brand` text NOT NULL,
	`name` text NOT NULL,
	`part_number` text,
	`is_oem` integer DEFAULT false NOT NULL,
	`search_query` text NOT NULL,
	`info_url` text,
	`notes_en` text,
	`notes_hu` text,
	`is_seed` integer DEFAULT false NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`model_id`) REFERENCES `vehicle_models`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `fitment_parts_model` ON `fitment_parts` (`model_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `fitment_parts_seed` ON `fitment_parts` (`model_id`,`seed_key`);--> statement-breakpoint
CREATE TABLE `meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `model_specs` (
	`id` text PRIMARY KEY NOT NULL,
	`model_id` text NOT NULL,
	`seed_key` text,
	`spec_group` text NOT NULL,
	`zone` text,
	`label_en` text NOT NULL,
	`label_hu` text NOT NULL,
	`value` text NOT NULL,
	`source` text,
	`is_seed` integer DEFAULT false NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`model_id`) REFERENCES `vehicle_models`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `model_specs_model` ON `model_specs` (`model_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `model_specs_seed` ON `model_specs` (`model_id`,`seed_key`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`vehicle_id` text NOT NULL,
	`event_id` text,
	`filename` text NOT NULL,
	`mime` text NOT NULL,
	`uploaded_by` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_id`) REFERENCES `vehicle_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `photos_vehicle` ON `photos` (`vehicle_id`);--> statement-breakpoint
CREATE INDEX `photos_event` ON `photos` (`event_id`);--> statement-breakpoint
CREATE TABLE `service_intervals` (
	`id` text PRIMARY KEY NOT NULL,
	`model_id` text NOT NULL,
	`task_key` text NOT NULL,
	`zone` text NOT NULL,
	`label_en` text NOT NULL,
	`label_hu` text NOT NULL,
	`interval_hours` real,
	`interval_km` real,
	`notes_en` text,
	`notes_hu` text,
	FOREIGN KEY (`model_id`) REFERENCES `vehicle_models`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `service_intervals_task` ON `service_intervals` (`model_id`,`task_key`);--> statement-breakpoint
CREATE TABLE `shops` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`country` text NOT NULL,
	`ships_to` text NOT NULL,
	`language` text NOT NULL,
	`homepage` text NOT NULL,
	`search_url_template` text NOT NULL,
	`sort_order` integer DEFAULT 100 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shops_name_unique` ON `shops` (`name`);--> statement-breakpoint
CREATE TABLE `spec_verifications` (
	`spec_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	PRIMARY KEY(`spec_id`, `user_id`),
	FOREIGN KEY (`spec_id`) REFERENCES `model_specs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`avatar_url` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `vehicle_events` (
	`id` text PRIMARY KEY NOT NULL,
	`vehicle_id` text NOT NULL,
	`author_id` text,
	`kind` text NOT NULL,
	`plan_status` text,
	`zone` text DEFAULT 'other' NOT NULL,
	`task_key` text,
	`title` text NOT NULL,
	`description` text,
	`event_date` text,
	`engine_hours` real,
	`odometer_km` real,
	`cost` real,
	`currency` text DEFAULT 'HUF' NOT NULL,
	`parts` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `vehicle_events_vehicle` ON `vehicle_events` (`vehicle_id`,`event_date`);--> statement-breakpoint
CREATE TABLE `vehicle_models` (
	`id` text PRIMARY KEY NOT NULL,
	`vehicle_type` text DEFAULT 'motorcycle' NOT NULL,
	`category` text DEFAULT 'mx' NOT NULL,
	`make` text NOT NULL,
	`model` text NOT NULL,
	`year_from` integer NOT NULL,
	`year_to` integer NOT NULL,
	`engine_cc` integer,
	`stroke` integer,
	`summary_en` text,
	`summary_hu` text,
	`parts_catalog_url` text,
	`owners_manual_url` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vehicle_models_unique` ON `vehicle_models` (`make`,`model`,`year_from`,`year_to`);--> statement-breakpoint
CREATE TABLE `vehicle_shares` (
	`vehicle_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	PRIMARY KEY(`vehicle_id`, `email`),
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `vehicle_shares_email` ON `vehicle_shares` (`email`);--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`model_id` text,
	`make` text NOT NULL,
	`model` text NOT NULL,
	`year` integer NOT NULL,
	`nickname` text,
	`vin` text,
	`engine_hours` real,
	`odometer_km` real,
	`purchase_date` text,
	`notes` text,
	`photo_id` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`model_id`) REFERENCES `vehicle_models`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `vehicles_owner` ON `vehicles` (`owner_id`);