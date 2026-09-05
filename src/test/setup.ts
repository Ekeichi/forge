import { vi } from 'vitest';

// Simuler next/headers
vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Headers()),
}));

// Simuler next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Simuler next/navigation : redirect() et notFound() interrompent le flux en
// production, on reproduit ce comportement par une exception identifiable.
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); }),
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
}));

// Simuler next/server : `after` s'exécute immédiatement dans les tests
vi.mock('next/server', () => ({
  after: vi.fn((callback: () => unknown) => { void callback(); }),
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
        delete: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
      },
      workspaceInvitation: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn(),
      },
      workspace: {
        create: vi.fn(),
        findFirst: vi.fn(),
      },
      document: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      agentRun: {
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
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
