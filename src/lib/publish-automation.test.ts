import { describe, it, expect, vi } from 'vitest';
import { detectarGatilhosDaLegenda, createAutomationForPublishedPost } from './publish-automation';

describe('detectarGatilhosDaLegenda', () => {
  it('detecta CTA explícito "Comente QUERO"', () => {
    const caption = 'Quer receber o checklist gratuito? Comente QUERO aqui nos comentários e te mando no direct!';
    const result = detectarGatilhosDaLegenda(caption);
    expect(result.detected).toBe(true);
    expect(result.keyword).toBe('QUERO');
    expect(result.suggestedKeywords).toEqual(['QUERO']);
    expect(result.suggestedDm).toContain('QUERO');
  });

  it('detecta variações com aspas e outros verbos como "digite \'LINK\'"', () => {
    const caption = 'Para acessar a aula completa, digite "AULA" agora mesmo.';
    const result = detectarGatilhosDaLegenda(caption);
    expect(result.detected).toBe(true);
    expect(result.keyword).toBe('AULA');
    expect(result.suggestedKeywords).toEqual(['AULA']);
  });

  it('ignora stop words genéricas como "comente abaixo"', () => {
    const caption = 'O que você achou dessa dica? Comente abaixo a sua opinião.';
    const result = detectarGatilhosDaLegenda(caption);
    expect(result.detected).toBe(false);
  });

  it('retorna defaults quando a legenda estiver vazia ou sem CTA', () => {
    const result = detectarGatilhosDaLegenda('');
    expect(result.detected).toBe(false);
    expect(result.suggestedKeywords).toEqual(['QUERO']);
  });
});

describe('createAutomationForPublishedPost', () => {
  it('não insere se enabled for false', async () => {
    const mockSupabase = {
      from: vi.fn(),
    } as any;

    const res = await createAutomationForPublishedPost(mockSupabase, {
      userId: 'user-123',
      instagramUserId: 'ig-456',
      igMediaId: 'media-789',
      config: {
        enabled: false,
        keywords: ['TESTE'],
        welcome_dm: 'DM teste',
      },
    });

    expect(res).toBeNull();
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('insere em automations com triggers: ["comments"] e specific_post_id correto', async () => {
    const singleMock = vi.fn().mockResolvedValue({ data: { id: 'auto-999' }, error: null });
    const selectMock = vi.fn().mockReturnValue({ single: singleMock });
    const insertMock = vi.fn().mockReturnValue({ select: selectMock });
    const mockSupabase = {
      from: vi.fn().mockReturnValue({ insert: insertMock }),
    } as any;

    const res = await createAutomationForPublishedPost(mockSupabase, {
      userId: 'user-123',
      instagramUserId: 'ig-456',
      igMediaId: 'media-789',
      postTitleOrCaption: 'Carrossel sobre Saúde Feminina',
      config: {
        enabled: true,
        keywords: ['QUERO', 'LINK'],
        welcome_dm: 'Aqui está seu link:',
        link_button_label: 'Acessar',
        link_url: 'https://exemplo.com',
        public_replies: ['Te enviei no direct!'],
      },
    });

    expect(res).toEqual({ id: 'auto-999' });
    expect(mockSupabase.from).toHaveBeenCalledWith('automations');
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-123',
        instagram_user_id: 'ig-456',
        triggers: ['comments'],
        specific_post_id: 'media-789',
        keywords: ['QUERO', 'LINK'],
        welcome_dm: 'Aqui está seu link:',
        link_button_label: 'Acessar',
        link_url: 'https://exemplo.com',
        public_replies: ['Te enviei no direct!'],
        active: true,
      })
    );
  });
});
