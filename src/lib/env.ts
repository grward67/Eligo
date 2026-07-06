function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Lazily read via getters so importing this module never throws by
// itself (important for edge middleware bundling) -- only accessing an
// unset value throws, at the point of use.
export const env = {
  get databaseUrl(): string {
    return required("DATABASE_URL");
  },
  get adminSessionSecret(): string {
    return required("ADMIN_SESSION_SECRET");
  },
  get voterSessionSecret(): string {
    return required("VOTER_SESSION_SECRET");
  },
  get accessCodeHashSecret(): string {
    return required("ACCESS_CODE_HASH_SECRET");
  },
};
