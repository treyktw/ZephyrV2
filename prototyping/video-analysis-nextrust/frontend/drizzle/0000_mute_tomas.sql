CREATE TABLE `videos` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`status` text DEFAULT 'uploading' NOT NULL,
	`frames_path` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP
);
