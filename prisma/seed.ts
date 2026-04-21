import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "demo@itempo.app";
  const password = "demodemo";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Demo user already exists.");
    return;
  }
  const user = await prisma.user.create({
    data: {
      email,
      name: "Demo",
      passwordHash: await bcrypt.hash(password, 10),
    },
  });
  const svc = await prisma.service.create({
    data: {
      userId: user.id,
      name: "Meditație Matematică",
      defaultDuration: 60,
      defaultPrice: 120,
      color: "#6366f1",
    },
  });
  const client = await prisma.client.create({
    data: { userId: user.id, name: "Ana Popescu", color: "#ec4899", phone: "0712 345 678" },
  });
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 17, 0);
  await prisma.appointment.create({
    data: {
      userId: user.id,
      clientId: client.id,
      serviceId: svc.id,
      startAt: start,
      endAt: new Date(start.getTime() + 60 * 60_000),
      price: 120,
      status: "SCHEDULED",
    },
  });
  console.log(`Seeded. Login: ${email} / ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
