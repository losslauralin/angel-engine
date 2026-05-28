CREATE TABLE `custom_agents` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`command` text NOT NULL,
	`args` text NOT NULL,
	`environment` text NOT NULL,
	`need_auth` integer DEFAULT false NOT NULL,
	`auto_authenticate` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
