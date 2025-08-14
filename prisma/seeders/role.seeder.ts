import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const roles = [
    {
      name: 'Super Admin',
      description:
        'User with full system access, billing access, AI config access',
    },
    {
      name: 'Admin',
      description: 'User with elevated permissions',
    },
    {
      name: 'Member',
      description: 'Standard user with limited access',
    },
  ];

  for (const role of roles) {
    await prisma.role.create({
      data: {
        name: role.name,
        description: role.description,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  console.log('Seeded roles successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  .finally(async () => await prisma.$disconnect());
