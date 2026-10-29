import { PrismaClient } from "./generated/prisma/client.js";
import { createPrismaAdapter } from "./prisma-adapter.js";

export const prisma = new PrismaClient({ adapter: createPrismaAdapter() });
