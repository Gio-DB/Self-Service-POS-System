import dotenv from "dotenv";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/prisma-adapter.js";

dotenv.config({ path: "../../.env" });

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

const menu = [
  {
    name: "Burgers",
    items: [
      { name: "Classic Burger", priceMinorUnits: 1299 },
      { name: "Veggie Burger", priceMinorUnits: 1099 },
    ],
  },
  {
    name: "Sides",
    items: [
      { name: "Fries", priceMinorUnits: 399 },
      { name: "Side Salad", priceMinorUnits: 499 },
    ],
  },
  {
    name: "Drinks",
    items: [
      { name: "Water", priceMinorUnits: 199 },
      { name: "Lemonade", priceMinorUnits: 299 },
    ],
  },
];

async function main() {
  for (const categoryData of menu) {
    const category = await prisma.menuCategory.upsert({
      where: { name: categoryData.name },
      update: {},
      create: { name: categoryData.name },
    });

    for (const item of categoryData.items) {
      await prisma.menuItem.upsert({
        where: {
          categoryId_name: { categoryId: category.id, name: item.name },
        },
        update: { priceMinorUnits: item.priceMinorUnits, isAvailable: true },
        create: {
          categoryId: category.id,
          name: item.name,
          priceMinorUnits: item.priceMinorUnits,
        },
      });
    }
  }
}

main()
  .catch((error: unknown) => {
    console.error("Failed to seed the demo menu:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
