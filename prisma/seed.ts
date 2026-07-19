import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in your .env before seeding.");
  }

  const passwordHash = await hashPassword(password);

  // This is a deliberately single-admin system (no signup UI). Update the
  // existing admin in place -- including its email -- rather than upsert
  // by email, which would silently create a second admin account if
  // ADMIN_EMAIL has changed since the last seed.
  const existing = await prisma.admin.findFirst();
  if (existing) {
    await prisma.admin.update({ where: { id: existing.id }, data: { email, passwordHash } });
  } else {
    await prisma.admin.create({ data: { email, passwordHash } });
  }

  console.log(`Admin account ready: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
