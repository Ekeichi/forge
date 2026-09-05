import { describe, it, expect, vi, beforeEach } from 'vitest';
import { removeMember, updateMemberRole } from '../actions';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

describe('updateMemberRole Server Action - Règles de sécurité', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Simuler une session valide par défaut
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: 'caller_1', email: 'caller@test.com', name: 'Caller', emailVerified: true, createdAt: new Date(), updatedAt: new Date(), image: null },
      session: { id: 's1', userId: 'caller_1', expiresAt: new Date(), ipAddress: '', userAgent: '', token: '', createdAt: new Date(), updatedAt: new Date() }
    });
  });

  const getFormData = (targetUserId: string, newRole: string) => {
    const formData = new FormData();
    formData.append('userId', targetUserId);
    formData.append('workspaceId', 'ws_123');
    formData.append('role', newRole);
    return formData;
  };

  it('MEMBER → appel direct refusé par le serveur', async () => {
    vi.mocked(prisma.workspaceMembership.findUnique).mockResolvedValueOnce({
      userId: 'caller_1', workspaceId: 'ws_123', role: 'MEMBER', createdAt: new Date()
    } as any);

    const result = await updateMemberRole(getFormData('target_1', 'ADMIN'));
    expect(result).toEqual({ error: "Vous n'avez pas les droits pour modifier les roles." });
  });

  it('ADMIN → modifier OWNER vers MEMBER (doit être interdit)', async () => {
    // Caller est ADMIN
    vi.mocked(prisma.workspaceMembership.findUnique).mockResolvedValueOnce({
      userId: 'caller_1', workspaceId: 'ws_123', role: 'ADMIN', createdAt: new Date()
    } as any);

    // Cible est OWNER
    vi.mocked(prisma.workspaceMembership.findUnique).mockResolvedValueOnce({
      userId: 'target_1', workspaceId: 'ws_123', role: 'OWNER', createdAt: new Date()
    } as any);

    const result = await updateMemberRole(getFormData('target_1', 'MEMBER'));
    expect(result).toEqual({ error: "Vous ne pouvez pas modifier le rôle du propriétaire." });
  });

  it('ADMIN → modifier MEMBER vers ADMIN (autorisé)', async () => {
    // Caller est ADMIN
    vi.mocked(prisma.workspaceMembership.findUnique).mockResolvedValueOnce({
      userId: 'caller_1', workspaceId: 'ws_123', role: 'ADMIN', createdAt: new Date()
    } as any);

    // Cible est MEMBER
    vi.mocked(prisma.workspaceMembership.findUnique).mockResolvedValueOnce({
      userId: 'target_1', workspaceId: 'ws_123', role: 'MEMBER', createdAt: new Date()
    } as any);

    const result = await updateMemberRole(getFormData('target_1', 'ADMIN'));
    expect(result).toEqual({ success: true });
  });

  it('OWNER → modifier son propre rôle (interdit pour éviter le blocage)', async () => {
    // Caller est OWNER
    vi.mocked(prisma.workspaceMembership.findUnique).mockResolvedValueOnce({
      userId: 'caller_1', workspaceId: 'ws_123', role: 'OWNER', createdAt: new Date()
    } as any);

    // Le caller cible son propre ID
    const result = await updateMemberRole(getFormData('caller_1', 'MEMBER'));
    expect(result).toEqual({ error: "Vous ne pouvez pas modifier votre propre rôle." });
  });

  it('OWNER → modifier MEMBER vers ADMIN (autorisé)', async () => {
    // Caller est OWNER
    vi.mocked(prisma.workspaceMembership.findUnique).mockResolvedValueOnce({
      userId: 'caller_1', workspaceId: 'ws_123', role: 'OWNER', createdAt: new Date()
    } as any);

    // Cible est MEMBER
    vi.mocked(prisma.workspaceMembership.findUnique).mockResolvedValueOnce({
      userId: 'target_1', workspaceId: 'ws_123', role: 'MEMBER', createdAt: new Date()
    } as any);

    const result = await updateMemberRole(getFormData('target_1', 'ADMIN'));
    expect(result).toEqual({ success: true });
  });
});

describe('removeMember Server Action - Révocation d\'accès', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: 'caller_1', email: 'caller@test.com', name: 'Caller', emailVerified: true, createdAt: new Date(), updatedAt: new Date(), image: null },
      session: { id: 's1', userId: 'caller_1', expiresAt: new Date(), ipAddress: '', userAgent: '', token: '', createdAt: new Date(), updatedAt: new Date() }
    });

    // $transaction execute le callback avec le client mocke
    vi.mocked(prisma.$transaction).mockImplementation(
      ((fn: (tx: typeof prisma) => unknown) => fn(prisma)) as never
    );
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ email: 'target@test.com' } as never);
  });

  const formData = (targetUserId: string) => {
    const fd = new FormData();
    fd.append('userId', targetUserId);
    fd.append('workspaceId', 'ws_123');
    return fd;
  };

  const asCaller = (role: 'OWNER' | 'ADMIN' | 'MEMBER') => vi.mocked(prisma.workspaceMembership.findUnique)
    .mockResolvedValueOnce({ userId: 'caller_1', workspaceId: 'ws_123', role, createdAt: new Date() } as never);
  const asTarget = (role: 'OWNER' | 'ADMIN' | 'MEMBER') => vi.mocked(prisma.workspaceMembership.findUnique)
    .mockResolvedValueOnce({ userId: 'target_1', workspaceId: 'ws_123', role, createdAt: new Date() } as never);

  it('MEMBER → retirer quelqu\'un est refusé', async () => {
    asCaller('MEMBER');

    const result = await removeMember(formData('target_1'));

    expect(result).toEqual({ error: "Vous n'avez pas les droits pour retirer un membre." });
    expect(prisma.workspaceMembership.delete).not.toHaveBeenCalled();
  });

  it('non-membre → retirer quelqu\'un est refusé', async () => {
    vi.mocked(prisma.workspaceMembership.findUnique).mockResolvedValueOnce(null as never);

    const result = await removeMember(formData('target_1'));

    expect(result).toEqual({ error: "Vous n'avez pas les droits pour retirer un membre." });
    expect(prisma.workspaceMembership.delete).not.toHaveBeenCalled();
  });

  it('ADMIN → retirer le OWNER est refusé', async () => {
    asCaller('ADMIN');
    asTarget('OWNER');

    const result = await removeMember(formData('target_1'));

    expect(result).toEqual({ error: "Vous ne pouvez pas retirer le propriétaire du workspace." });
    expect(prisma.workspaceMembership.delete).not.toHaveBeenCalled();
  });

  it('ADMIN → se retirer soi-même est refusé', async () => {
    asCaller('ADMIN');

    const result = await removeMember(formData('caller_1'));

    expect(result).toEqual({ error: "Vous ne pouvez pas vous retirer vous-même du workspace." });
    expect(prisma.workspaceMembership.delete).not.toHaveBeenCalled();
  });

  it('ADMIN → retirer un MEMBER supprime l\'appartenance et l\'invitation', async () => {
    asCaller('ADMIN');
    asTarget('MEMBER');

    const result = await removeMember(formData('target_1'));

    expect(result).toEqual({ success: true });
    expect(prisma.workspaceMembership.delete).toHaveBeenCalledWith({
      where: { userId_workspaceId: { userId: 'target_1', workspaceId: 'ws_123' } },
    });
    // sinon l'invitation acceptée resterait un moyen de revenir
    expect(prisma.workspaceInvitation.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: 'ws_123', email: 'target@test.com' },
    });
  });
});
