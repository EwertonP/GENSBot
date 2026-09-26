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
});
