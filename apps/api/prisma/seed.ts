import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seeds a single dev clinic (Atria Wellness) so local development and e2e
 * tests have a tenant to work against. Extend per-module as Patients,
 * Appointments, etc. are built.
 */
async function main() {
  await prisma.clinic.upsert({
    where: { slug: "atria-wellness" },
    update: {},
    create: {
      name: "Atria Wellness",
      slug: "atria-wellness",
      brandingConfig: { primaryColor: "#2F6F5E" },
      settings: {},
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
