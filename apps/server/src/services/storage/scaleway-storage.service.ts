/**
 * Scaleway Object Storage Service
 *
 * Service de stockage S3-compatible pour fichiers utilisateurs.
 * Conforme RGPD - Datacenters en France (Paris).
 *
 * @see https://www.scaleway.com/en/docs/object-storage/api-cli/object-storage-aws-cli/
 * @see https://github.com/aws/aws-sdk-js-v3/blob/main/packages/s3-request-presigner/README.md
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/environment.config.js';
import { logger } from '../../lib/observability.js';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration Scaleway Object Storage
 * Endpoint format: https://s3.<region>.scw.cloud
 */
const SCALEWAY_CONFIG = {
  // Régions disponibles: fr-par (Paris), nl-ams (Amsterdam), pl-waw (Warsaw)
  region: env.SCALEWAY_REGION ?? 'fr-par',
  bucket: env.SCALEWAY_BUCKET ?? '',

  // Endpoint S3 Scaleway
  getEndpoint: () => `https://s3.${env.SCALEWAY_REGION ?? 'fr-par'}.scw.cloud`,

  // Presigned URL expiration (secondes)
  presignedUploadExpiry: 3600, // 1 heure pour upload
  presignedDownloadExpiry: 3600, // 1 heure pour download

  // Taille max fichier (10MB pour images/docs)
  maxFileSizeBytes: 10 * 1024 * 1024,
};

// ============================================================================
// Types
// ============================================================================

export interface PresignedUploadResult {
  uploadUrl: string;
  fileId: string;
  storageKey: string;
  expiresAt: Date;
}

export interface PresignedDownloadResult {
  downloadUrl: string;
  expiresAt: Date;
}

export interface StoredFileInfo {
  storageKey: string;
  bucket: string;
  region: string;
  sizeBytes: number;
  contentType: string;
}

// ============================================================================
// S3 Client Singleton
// ============================================================================

let s3Client: S3Client | null = null;

/**
 * Initialise le client S3 pour Scaleway
 * Pattern singleton pour réutiliser les connexions
 */
function getS3Client(): S3Client {
  if (s3Client) {
    return s3Client;
  }

  // Vérification configuration
  if (!env.SCALEWAY_ACCESS_KEY || !env.SCALEWAY_SECRET_KEY) {
    throw new Error(
      'Scaleway credentials not configured. Set SCALEWAY_ACCESS_KEY and SCALEWAY_SECRET_KEY environment variables.'
    );
  }

  if (!env.SCALEWAY_BUCKET) {
    throw new Error(
      'Scaleway bucket not configured. Set SCALEWAY_BUCKET environment variable.'
    );
  }

  // Configuration S3Client selon documentation AWS SDK v3
  // @see https://github.com/aws/aws-sdk-js-v3/blob/main/supplemental-docs/CLIENTS.md
  s3Client = new S3Client({
    region: SCALEWAY_CONFIG.region,
    endpoint: SCALEWAY_CONFIG.getEndpoint(),
    credentials: {
      accessKeyId: env.SCALEWAY_ACCESS_KEY,
      secretAccessKey: env.SCALEWAY_SECRET_KEY,
    },
    // Force path-style pour compatibilité Scaleway
    forcePathStyle: true,
  });

  logger.info('Scaleway S3 client initialized', {
    operation: 'scaleway:init',
    region: SCALEWAY_CONFIG.region,
    bucket: env.SCALEWAY_BUCKET,
    endpoint: SCALEWAY_CONFIG.getEndpoint(),
  });

  return s3Client;
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Génère une URL présignée pour upload direct depuis le frontend
 * Le fichier est uploadé directement vers Scaleway sans passer par le backend
 *
 * @see https://github.com/aws/aws-sdk-js-v3/blob/main/packages/s3-request-presigner/README.md
 */
export async function generatePresignedUploadUrl(params: {
  userId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<PresignedUploadResult> {
  const { userId, fileName, mimeType, sizeBytes } = params;

  // Validation taille
  if (sizeBytes > SCALEWAY_CONFIG.maxFileSizeBytes) {
    throw new Error(
      `File too large: ${sizeBytes} bytes. Maximum: ${SCALEWAY_CONFIG.maxFileSizeBytes} bytes (10MB).`
    );
  }

  // Générer ID unique et clé de stockage
  const fileId = crypto.randomUUID();
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storageKey = `uploads/${userId}/${timestamp}-${fileId}-${sanitizedFileName}`;

  const client = getS3Client();

  // Créer la commande PutObject avec Content-Type signé
  // @see https://github.com/aws/aws-sdk-js-v3/blob/main/packages/s3-request-presigner/README.md
  const command = new PutObjectCommand({
    Bucket: env.SCALEWAY_BUCKET,
    Key: storageKey,
    ContentType: mimeType,
    ContentLength: sizeBytes,
    // Métadonnées custom
    Metadata: {
      'user-id': userId,
      'original-filename': fileName,
      'upload-timestamp': timestamp.toString(),
    },
  });

  // Générer URL présignée avec Content-Type signé
  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: SCALEWAY_CONFIG.presignedUploadExpiry,
    // Signer le Content-Type pour sécurité
    signableHeaders: new Set(['content-type', 'content-length']),
  });

  const expiresAt = new Date(Date.now() + SCALEWAY_CONFIG.presignedUploadExpiry * 1000);

  logger.info('Presigned upload URL generated', {
    operation: 'scaleway:presign-upload',
    userId,
    fileId,
    storageKey,
    mimeType,
    sizeBytes,
    expiresAt: expiresAt.toISOString(),
  });

  return {
    uploadUrl,
    fileId,
    storageKey,
    expiresAt,
  };
}

/**
 * Génère une URL présignée pour téléchargement
 */
export async function generatePresignedDownloadUrl(
  storageKey: string
): Promise<PresignedDownloadResult> {
  const client = getS3Client();

  const command = new GetObjectCommand({
    Bucket: env.SCALEWAY_BUCKET,
    Key: storageKey,
  });

  const downloadUrl = await getSignedUrl(client, command, {
    expiresIn: SCALEWAY_CONFIG.presignedDownloadExpiry,
  });

  const expiresAt = new Date(Date.now() + SCALEWAY_CONFIG.presignedDownloadExpiry * 1000);

  logger.debug('Presigned download URL generated', {
    operation: 'scaleway:presign-download',
    storageKey,
    expiresAt: expiresAt.toISOString(),
  });

  return {
    downloadUrl,
    expiresAt,
  };
}

/**
 * Vérifie qu'un fichier existe et récupère ses métadonnées
 */
export async function getFileInfo(storageKey: string): Promise<StoredFileInfo | null> {
  const client = getS3Client();

  try {
    const command = new HeadObjectCommand({
      Bucket: env.SCALEWAY_BUCKET,
      Key: storageKey,
    });

    const response = await client.send(command);

    return {
      storageKey,
      bucket: env.SCALEWAY_BUCKET ?? '',
      region: SCALEWAY_CONFIG.region,
      sizeBytes: response.ContentLength ?? 0,
      contentType: response.ContentType ?? 'application/octet-stream',
    };
  } catch (error) {
    // Fichier non trouvé
    if ((error as { name?: string }).name === 'NotFound') {
      return null;
    }
    throw error;
  }
}

/**
 * Supprime un fichier du stockage
 */
export async function deleteFile(storageKey: string): Promise<boolean> {
  const client = getS3Client();

  try {
    const command = new DeleteObjectCommand({
      Bucket: env.SCALEWAY_BUCKET,
      Key: storageKey,
    });

    await client.send(command);

    logger.info('File deleted from storage', {
      operation: 'scaleway:delete',
      storageKey,
    });

    return true;
  } catch (error) {
    logger.error('Failed to delete file from storage', {
      _error: error instanceof Error ? error.message : String(error),
      operation: 'scaleway:delete',
      storageKey,
      severity: 'medium' as const,
    });
    return false;
  }
}

/**
 * Récupère le contenu d'un fichier (pour envoi à Mistral).
 */
export async function getFileContent(storageKey: string): Promise<{
  content: Buffer;
  contentType: string;
} | null> {
  const client = getS3Client();

  try {
    const command = new GetObjectCommand({
      Bucket: env.SCALEWAY_BUCKET,
      Key: storageKey,
    });

    const response = await client.send(command);

    if (!response.Body) {
      return null;
    }

    // Convertir le stream en Buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    const content = Buffer.concat(chunks);

    return {
      content,
      contentType: response.ContentType ?? 'application/octet-stream',
    };
  } catch (error) {
    logger.error('Failed to get file content', {
      _error: error instanceof Error ? error.message : String(error),
      operation: 'scaleway:get-content',
      storageKey,
      severity: 'medium' as const,
    });
    return null;
  }
}

/**
 * Vérifie si le service Scaleway est correctement configuré
 */
export function isConfigured(): boolean {
  return !!(
    env.SCALEWAY_ACCESS_KEY &&
    env.SCALEWAY_SECRET_KEY &&
    env.SCALEWAY_BUCKET
  );
}

/**
 * Health check du service
 */
export async function healthCheck(): Promise<{
  status: 'healthy' | 'unhealthy' | 'not_configured';
  message: string;
}> {
  if (!isConfigured()) {
    return {
      status: 'not_configured',
      message: 'Scaleway credentials not configured',
    };
  }

  try {
    const client = getS3Client();

    // Tester avec une requête HEAD sur le bucket
    const command = new HeadObjectCommand({
      Bucket: env.SCALEWAY_BUCKET,
      Key: '.health-check', // Fichier qui n'existe probablement pas
    });

    try {
      await client.send(command);
    } catch (error) {
      // NotFound est OK, ça veut dire que le bucket est accessible
      if ((error as { name?: string }).name !== 'NotFound') {
        throw error;
      }
    }

    return {
      status: 'healthy',
      message: `Connected to Scaleway ${SCALEWAY_CONFIG.region}`,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Export du service
export const scalewayStorageService = {
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
  getFileInfo,
  deleteFile,
  getFileContent,
  isConfigured,
  healthCheck,
};
