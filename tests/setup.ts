// Dummy env values so lib/env.ts and every module that reads secrets at
// call time works under `vitest run` without needing a real .env.
process.env.ADMIN_SESSION_SECRET ??= "test-admin-secret-do-not-use-in-prod";
process.env.VOTER_SESSION_SECRET ??= "test-voter-secret-do-not-use-in-prod";
process.env.ACCESS_CODE_HASH_SECRET ??= "test-access-code-secret-do-not-use";
process.env.DATABASE_URL ??= "file:./test.db";
