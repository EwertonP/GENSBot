import { S3Client, PutObjectCommand, DeleteObjectsCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Retorna se o Cloudflare R2 está configurado nas variáveis de ambiente.
 */
export function isR2Configured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}

/**
 * Cria ou recupera a instância do cliente S3 apontando para o endpoint do Cloudflare R2.
 */
export function getR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Credenciais do Cloudflare R2 ausentes no ambiente.');
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

/**
 * Gera uma URL pré-assinada para upload direto (HTTP PUT) do navegador para o Cloudflare R2.
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds: number = 3600
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const bucketName = process.env.R2_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('R2_BUCKET_NAME não configurado.');
  }

  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType || 'application/octet-stream',
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });

  // Constrói a URL pública final
  const publicBaseUrl = (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');
  const appHost = (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
  ).replace(/\/+$/, '');

  const publicUrl = publicBaseUrl
    ? `${publicBaseUrl}/${key}`
    : appHost
    ? `${appHost}/api/storage/media/${key}`
    : `/api/storage/media/${key}`;

  return { uploadUrl, publicUrl };
}

/**
 * Remove um ou mais arquivos do Cloudflare R2 dado um array de chaves ou URLs.
 */
export async function deleteR2Objects(keysOrUrls: string[]): Promise<string[]> {
  if (!isR2Configured() || !keysOrUrls || keysOrUrls.length === 0) return [];

  const bucketName = process.env.R2_BUCKET_NAME!;
  const client = getR2Client();

  const keysToDelete: string[] = [];
  const publicBaseUrl = (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');

  for (const item of keysOrUrls) {
    if (!item) continue;
    let key = item;

    // Se for URL completa, extrai a chave
    if (item.startsWith('http://') || item.startsWith('https://')) {
      if (publicBaseUrl && item.startsWith(publicBaseUrl)) {
        key = item.replace(publicBaseUrl, '').replace(/^\/+/, '');
      } else {
        const urlObj = new URL(item);
        key = urlObj.pathname.replace(/^\/+/, '');
        // Caso a pathname contenha o nome do bucket no início
        if (key.startsWith(`${bucketName}/`)) {
          key = key.replace(`${bucketName}/`, '');
        }
      }
    }

    if (key) {
      keysToDelete.push(decodeURIComponent(key));
    }
  }

  if (keysToDelete.length === 0) return [];

  try {
    if (keysToDelete.length === 1) {
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: keysToDelete[0],
        })
      );
    } else {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucketName,
          Delete: {
            Objects: keysToDelete.map((Key) => ({ Key })),
            Quiet: true,
          },
        })
      );
    }
    console.log(`[R2 Cleanup] ${keysToDelete.length} arquivo(s) removido(s) do bucket R2:`, keysToDelete);
    return keysToDelete;
  } catch (err) {
    console.error('Erro ao deletar objetos no Cloudflare R2:', err);
    return [];
  }
}
