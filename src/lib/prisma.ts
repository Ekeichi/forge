import { PrismaClient } from "../generated/prisma/client";

const prismaClientSingleton = () => {
  return new PrismaClient();
};

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

// We force a new instance here temporarily because Next.js caches the old Prisma client 
// in development. This ensures the newly generated WorkspaceInvitation model is picked up!
const prisma = prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = prisma;
