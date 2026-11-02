-- Better Auth tables (lib/auth/auth.ts), for email/password sign-in.
-- Generated with better-auth/db/migration's compileMigrations() for MySQL
-- (better-auth 1.7.7). Apply once to the app database:
--   mysql -u <user> -p <database> < scripts/better-auth-schema.sql
-- Regenerate if Better Auth is upgraded and its schema changes.
-- Hand-edited: the generated inline `userId ... references user (id)` clauses
-- are moved to table-level FOREIGN KEY constraints, because MySQL 8 silently
-- ignores inline column REFERENCES (so deleting a user wouldn't delete its
-- sessions).

create table `user` (`id` varchar(36) not null primary key, `name` varchar(255) not null, `email` varchar(255) not null unique, `emailVerified` boolean not null, `image` text, `createdAt` timestamp(3) default CURRENT_TIMESTAMP(3) not null, `updatedAt` timestamp(3) default CURRENT_TIMESTAMP(3) not null);

create table `session` (`id` varchar(36) not null primary key, `expiresAt` timestamp(3) not null, `token` varchar(255) not null unique, `createdAt` timestamp(3) default CURRENT_TIMESTAMP(3) not null, `updatedAt` timestamp(3) not null, `ipAddress` text, `userAgent` text, `userId` varchar(36) not null, foreign key (`userId`) references `user` (`id`) on delete cascade);

create table `account` (`id` varchar(36) not null primary key, `accountId` text not null, `providerId` text not null, `userId` varchar(36) not null, `accessToken` text, `refreshToken` text, `idToken` text, `accessTokenExpiresAt` timestamp(3), `refreshTokenExpiresAt` timestamp(3), `scope` text, `password` text, `createdAt` timestamp(3) default CURRENT_TIMESTAMP(3) not null, `updatedAt` timestamp(3) not null, foreign key (`userId`) references `user` (`id`) on delete cascade);

create table `verification` (`id` varchar(36) not null primary key, `identifier` varchar(255) not null, `value` text not null, `expiresAt` timestamp(3) not null, `createdAt` timestamp(3) default CURRENT_TIMESTAMP(3) not null, `updatedAt` timestamp(3) default CURRENT_TIMESTAMP(3) not null);

create index `session_userId_idx` on `session` (`userId`);

create index `account_userId_idx` on `account` (`userId`);

create index `verification_identifier_idx` on `verification` (`identifier`);
