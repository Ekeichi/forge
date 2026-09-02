import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateMemberRole } from '../actions';
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
