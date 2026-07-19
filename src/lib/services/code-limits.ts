// Shared between code-service.ts (server) and the admin generate-code form
// (client) so both enforce the same bound. Kept in its own file, with no
// Prisma import, so the client component can import it safely.
export const MAX_GENERATE_COUNT = 5000;
