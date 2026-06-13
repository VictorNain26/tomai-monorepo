/**
 * useFiles Hook - Classeur (Document Library)
 *
 * Gère la bibliothèque de documents de l'élève et
 * l'attachement de fichiers aux sessions de chat.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTreaty, unwrap } from '@repo/api';

// ============================================================================
// Types
// ============================================================================

export interface LibraryFile {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  documentType: string | null;
  subject: string | null;
  createdAt: string;
}

interface SessionFile {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  attachedAt: string;
}

// ============================================================================
// Query Keys
// ============================================================================

export const filesQueryKeys = {
  all: ['files'] as const,
  library: () => [...filesQueryKeys.all, 'library'] as const,
  sessionFiles: (sessionId: string) => [...filesQueryKeys.all, 'session', sessionId] as const,
};

// ============================================================================
// API Functions
// ============================================================================

async function fetchUserFiles(): Promise<LibraryFile[]> {
  const data = unwrap(await getTreaty().api.files.get());
  return (data as { files: LibraryFile[] }).files;
}

async function fetchSessionFiles(sessionId: string): Promise<SessionFile[]> {
  const data = unwrap(
    await getTreaty().api.chat.session({ id: sessionId }).files.get()
  );
  return (data as { files: SessionFile[] }).files;
}

async function attachFileToSession(sessionId: string, fileId: string): Promise<void> {
  unwrap(
    await getTreaty().api.chat.session({ id: sessionId }).files.post({ fileId })
  );
}

async function detachFileFromSession(sessionId: string, fileId: string): Promise<void> {
  unwrap(
    await getTreaty().api.chat.session({ id: sessionId }).files({ fileId }).delete()
  );
}

// ============================================================================
// Hooks
// ============================================================================

export function useUserFiles() {
  const query = useQuery({
    queryKey: filesQueryKeys.library(),
    queryFn: fetchUserFiles,
    staleTime: 2 * 60 * 1000,
  });

  return {
    files: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}

export function useSessionFiles(sessionId: string | null) {
  const query = useQuery({
    queryKey: filesQueryKeys.sessionFiles(sessionId ?? '__none__'),
    queryFn: () => fetchSessionFiles(sessionId!),
    enabled: !!sessionId,
    staleTime: 30 * 1000,
  });

  return {
    files: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}

export function useAttachFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, fileId }: { sessionId: string; fileId: string }) =>
      attachFileToSession(sessionId, fileId),
    onSuccess: (_data, { sessionId }) => {
      void queryClient.invalidateQueries({ queryKey: filesQueryKeys.sessionFiles(sessionId) });
    },
  });
}

export function useDetachFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, fileId }: { sessionId: string; fileId: string }) =>
      detachFileFromSession(sessionId, fileId),
    onSuccess: (_data, { sessionId }) => {
      void queryClient.invalidateQueries({ queryKey: filesQueryKeys.sessionFiles(sessionId) });
    },
  });
}
