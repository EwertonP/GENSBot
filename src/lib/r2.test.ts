import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isR2Configured, deleteR2Objects } from './r2';

describe('Cloudflare R2 Storage Helper', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('isR2Configured retorna false quando faltam variáveis de ambiente', () => {
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET_NAME;

    expect(isR2Configured()).toBe(false);
  });

  it('isR2Configured retorna true quando todas as variáveis obrigatórias estão presentes', () => {
    process.env.R2_ACCOUNT_ID = 'test-account-id';
    process.env.R2_ACCESS_KEY_ID = 'test-key-id';
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
    process.env.R2_BUCKET_NAME = 'gensbot-media';

    expect(isR2Configured()).toBe(true);
  });

  it('deleteR2Objects retorna array vazio e não quebra se o R2 não estiver configurado', async () => {
    delete process.env.R2_ACCOUNT_ID;
    const result = await deleteR2Objects(['https://pub-123.r2.dev/uploads/test.mp4']);
    expect(result).toEqual([]);
  });

  it('valida upload, CORS preflight e URL pública pub-xxx.r2.dev', async () => {
    const fs = await import('fs');
    const dotenv = await import('dotenv');
    if (fs.existsSync('.env.local')) {
      const env = dotenv.parse(fs.readFileSync('.env.local'));
      Object.assign(process.env, env);
    }

    const { getPresignedUploadUrl } = await import('./r2');
    const testKey = `test-verify-${Date.now()}.txt`;
    const { uploadUrl, publicUrl } = await getPresignedUploadUrl(testKey, 'text/plain');

    console.log('Public URL gerada:', publicUrl);
    expect(publicUrl).toBe(`https://pub-0a8a2898e20945f9bb1774f7b9ea1bd9.r2.dev/${testKey}`);

    // 1. Testa OPTIONS (CORS preflight do navegador)
    const optionsRes = await fetch(uploadUrl, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://allingens.vercel.app',
        'Access-Control-Request-Method': 'PUT',
        'Access-Control-Request-Headers': 'content-type',
      },
    });
    console.log('CORS Preflight status:', optionsRes.status, optionsRes.statusText);
    console.log('Access-Control-Allow-Origin:', optionsRes.headers.get('access-control-allow-origin'));
    expect(optionsRes.ok).toBe(true);
    expect(optionsRes.headers.get('access-control-allow-origin')).toBeTruthy();

    // 2. Testa PUT upload
    const testContent = `Verificacao R2 GENSBot ${Date.now()}`;
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain' },
      body: testContent,
    });
    console.log('PUT status:', putRes.status, putRes.statusText);
    expect(putRes.ok).toBe(true);

    // 3. Testa leitura direta pela URL pública R2.dev
    const getRes = await fetch(publicUrl);
    console.log('GET R2.dev public URL status:', getRes.status, getRes.statusText);
    // 4. Limpa o arquivo de teste no R2
    const { deleteR2Objects } = await import('./r2');
    await deleteR2Objects([publicUrl]);
  });
});
