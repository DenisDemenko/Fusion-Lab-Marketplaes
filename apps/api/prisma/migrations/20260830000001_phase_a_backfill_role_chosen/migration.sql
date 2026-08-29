-- Every account that exists before this migration (seeded admin, seeded
-- lab seller, any real signup) has role set but roleChosenAt still NULL,
-- since that column didn't exist when they were created. Left unbackfilled,
-- RoleGate on the frontend would treat every one of them as "hasn't picked
-- a role yet" and block them behind the picker on their very next login —
-- including the admin account itself. Backdating to createdAt keeps the
-- semantics honest: their role was, in effect, chosen (by seed data or by
-- whatever flow created them) at account creation time.
UPDATE "User" SET "roleChosenAt" = "createdAt" WHERE "roleChosenAt" IS NULL;
