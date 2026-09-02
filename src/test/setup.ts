import { vi } from 'vitest';

// Simuler next/headers
vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Headers()),
}));

// Simuler next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Simuler Prisma (on instancie un objet mock)
vi.mock('@/lib/prisma', () => {
  return {
    default: {
      workspaceMembership: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
      },
      workspaceInvitation: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      workspace: {
        create: vi.fn(),
        findFirst: vi.fn(),
      },
      $transaction: vi.fn(),
    },
  };
});

// Simuler Better Auth
vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));
