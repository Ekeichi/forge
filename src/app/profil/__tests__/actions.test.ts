import { describe, it, expect, vi, beforeEach } from 'vitest';
import { inviteMember } from '../actions';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

describe('inviteMember Server Action - Règles de sécurité', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Par défaut, l'utilisateur est connecté
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: 'inviter_1', email: 'inviter@test.com', name: 'Inviter', emailVerified: true, createdAt: new Date(), updatedAt: new Date(), image: null },
      session: { id: 's1', userId: 'inviter_1', expiresAt: new Date(), ipAddress: '', userAgent: '', token: '', createdAt: new Date(), updatedAt: new Date() }
    });

    // Par défaut, l'utilisateur invité existe dans la base
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'invited_1',
      email: 'test@test.com',
      name: 'Test',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      image: null
    });

    // Par défaut, l'utilisateur invité n'est PAS encore membre
    vi.mocked(prisma.workspaceMembership.findUnique).mockImplementation(async (args: any) => {
      // Si on vérifie l'appartenance de l'invité
      if (args.where?.userId_workspaceId?.userId === 'invited_1') {
        return null;
      }
      return null;
    });
  });

  const getFormData = () => {
    const formData = new FormData();
    formData.append('email', 'test@test.com');
    formData.append('workspaceId', 'ws_123');
    return formData;
  };

  it('1. OWNER → peut ajouter', async () => {
    vi.mocked(prisma.workspaceMembership.findUnique).mockImplementation(async (args: any) => {
      if (args.where?.userId_workspaceId?.userId === 'inviter_1') {
        return { userId: 'inviter_1', workspaceId: 'ws_123', role: 'OWNER', createdAt: new Date() } as any;
      }
      return null; // L'invité n'est pas membre
    });

    const result = await inviteMember(getFormData());
    expect(result).toEqual({ success: true });
  });

  it('2. ADMIN → peut ajouter', async () => {
    vi.mocked(prisma.workspaceMembership.findUnique).mockImplementation(async (args: any) => {
      if (args.where?.userId_workspaceId?.userId === 'inviter_1') {
        return { userId: 'inviter_1', workspaceId: 'ws_123', role: 'ADMIN', createdAt: new Date() } as any;
      }
      return null;
    });

    const result = await inviteMember(getFormData());
    expect(result).toEqual({ success: true });
  });

  it('3. MEMBER → interdit', async () => {
    vi.mocked(prisma.workspaceMembership.findUnique).mockImplementation(async (args: any) => {
      if (args.where?.userId_workspaceId?.userId === 'inviter_1') {
        return { userId: 'inviter_1', workspaceId: 'ws_123', role: 'MEMBER', createdAt: new Date() } as any;
      }
      return null;
    });

    const result = await inviteMember(getFormData());
    expect(result).toEqual({ error: "Vous n'avez pas les droits pour inviter sur ce workspace" });
  });

  it('4. user inexistant → erreur', async () => {
    vi.mocked(prisma.workspaceMembership.findUnique).mockImplementation(async (args: any) => {
      if (args.where?.userId_workspaceId?.userId === 'inviter_1') {
        return { userId: 'inviter_1', workspaceId: 'ws_123', role: 'OWNER', createdAt: new Date() } as any;
      }
      return null;
    });

    // L'utilisateur qu'on essaie d'inviter n'existe pas en base
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const result = await inviteMember(getFormData());
    expect(result).toEqual({ error: "Cet utilisateur n'existe pas" });
  });

  it('5. déjà membre → erreur', async () => {
    vi.mocked(prisma.workspaceMembership.findUnique).mockImplementation(async (args: any) => {
      if (args.where?.userId_workspaceId?.userId === 'inviter_1') {
        // L'appelant a les droits
        return { userId: 'inviter_1', workspaceId: 'ws_123', role: 'OWNER', createdAt: new Date() } as any;
      }
      if (args.where?.userId_workspaceId?.userId === 'invited_1') {
        // L'invité est déjà membre
        return { userId: 'invited_1', workspaceId: 'ws_123', role: 'MEMBER', createdAt: new Date() } as any;
      }
      return null;
    });

    const result = await inviteMember(getFormData());
    expect(result).toEqual({ error: "Cette personne est déjà membre du workspace" });
  });

  it('6. workspace inaccessible → interdit', async () => {
    vi.mocked(prisma.workspaceMembership.findUnique).mockImplementation(async (args: any) => {
      // L'appelant n'a aucune membership dans ce workspace
      return null;
    });

    const result = await inviteMember(getFormData());
    expect(result).toEqual({ error: "Vous n'avez pas les droits pour inviter sur ce workspace" });
  });

  it('7. rôle invalide → erreur', async () => {
    vi.mocked(prisma.workspaceMembership.findUnique).mockImplementation(async (args: any) => {
      if (args.where?.userId_workspaceId?.userId === 'inviter_1') {
        // Un rôle absurde ou invalide pour tester la robustesse
        return { userId: 'inviter_1', workspaceId: 'ws_123', role: 'GUEST_FANTOME', createdAt: new Date() } as any;
      }
      return null;
    });

    const result = await inviteMember(getFormData());
    expect(result).toEqual({ error: "Vous n'avez pas les droits pour inviter sur ce workspace" });
  });
});
