import { PrismaClient } from "@prisma/client";

// Una sola instancia de Prisma para toda la API.
export const prisma = new PrismaClient();
