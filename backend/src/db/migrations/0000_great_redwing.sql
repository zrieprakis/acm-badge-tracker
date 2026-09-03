CREATE TABLE `access_event_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_member_id` integer NOT NULL,
	`door_name` text,
	`door_id` text,
	`event_type` text,
	`event_timestamp` text NOT NULL,
	`raw_event_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`team_member_id`) REFERENCES `team_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `admin_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`last_login_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_users_username_unique` ON `admin_users` (`username`);--> statement-breakpoint
CREATE TABLE `last_access_events` (
	`team_member_id` integer PRIMARY KEY NOT NULL,
	`door_name` text,
	`door_id` text,
	`event_type` text,
	`event_timestamp` text,
	`raw_event_id` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`team_member_id`) REFERENCES `team_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`sid` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_metadata` (
	`id` integer PRIMARY KEY NOT NULL,
	`last_poll_started_at` text,
	`last_poll_completed_at` text,
	`last_poll_success` integer,
	`last_poll_error` text,
	`last_successful_poll_at` text,
	`consecutive_failure_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `team_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`display_name` text NOT NULL,
	`acm_cardholder_id` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_members_acm_cardholder_id_unique` ON `team_members` (`acm_cardholder_id`);