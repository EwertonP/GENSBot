-- Migration: Reestruturação do Funil de Prospecção SDR (8 Etapas com 'A Iniciar' em primeiro)
-- Atualiza as etapas do pipeline padrão da agência ('Prospecção Agência') sem perda de dados

DO $$
DECLARE
  r_pipe RECORD;
  v_stage_iniciar_id uuid;
  v_stage_novo_id uuid;
  v_stage_contato_id uuid;
  v_stage_acomp_id uuid;
  v_stage_prop_id uuid;
  v_stage_follow_id uuid;
  v_stage_fech_id uuid;
  v_stage_perda_id uuid;
  v_stage_extra_id uuid;
BEGIN
  -- Percorre todos os pipelines da agência (cliente_id IS NULL)
  FOR r_pipe IN 
    SELECT id FROM public.crm_pipelines WHERE cliente_id IS NULL AND ativo = true
  LOOP
    -- 1. Cria ou garante 'A Iniciar' em primeiro (ordem 0)
    SELECT id INTO v_stage_iniciar_id FROM public.crm_estagios 
    WHERE pipeline_id = r_pipe.id AND nome ILIKE '%a iniciar%'
    LIMIT 1;

    IF v_stage_iniciar_id IS NOT NULL THEN
      UPDATE public.crm_estagios 
      SET nome = 'A Iniciar', cor = '#06b6d4', ordem = 0, tipo_conclusao = 'aberto', dias_limite_estagnado = 2
      WHERE id = v_stage_iniciar_id;
    ELSE
      INSERT INTO public.crm_estagios (pipeline_id, nome, cor, ordem, tipo_conclusao, dias_limite_estagnado)
      VALUES (r_pipe.id, 'A Iniciar', '#06b6d4', 0, 'aberto', 2)
      RETURNING id INTO v_stage_iniciar_id;
    END IF;

    -- 2. Renomeia ou cria 'Novo Prospect' em segundo (ordem 1)
    SELECT id INTO v_stage_novo_id FROM public.crm_estagios 
    WHERE pipeline_id = r_pipe.id AND (nome ILIKE '%minerado%' OR nome ILIKE '%novo prospect%')
    LIMIT 1;

    IF v_stage_novo_id IS NOT NULL THEN
      UPDATE public.crm_estagios 
      SET nome = 'Novo Prospect', cor = '#3b82f6', ordem = 1, tipo_conclusao = 'aberto', dias_limite_estagnado = 2
      WHERE id = v_stage_novo_id;
    ELSE
      INSERT INTO public.crm_estagios (pipeline_id, nome, cor, ordem, tipo_conclusao, dias_limite_estagnado)
      VALUES (r_pipe.id, 'Novo Prospect', '#3b82f6', 1, 'aberto', 2)
      RETURNING id INTO v_stage_novo_id;
    END IF;

    -- Move os leads não iniciados de 'Novo Prospect' para 'A Iniciar'
    IF v_stage_iniciar_id IS NOT NULL AND v_stage_novo_id IS NOT NULL THEN
      UPDATE public.crm_negocios 
      SET estagio_id = v_stage_iniciar_id 
      WHERE estagio_id = v_stage_novo_id;
    END IF;

    -- 3. Renomeia ou cria 'Primeiro Contato' (ordem 2)
    SELECT id INTO v_stage_contato_id FROM public.crm_estagios 
    WHERE pipeline_id = r_pipe.id AND (nome ILIKE '%abordagem%' OR nome ILIKE '%primeiro contato%')
    LIMIT 1;

    IF v_stage_contato_id IS NOT NULL THEN
      UPDATE public.crm_estagios 
      SET nome = 'Primeiro Contato', cor = '#8b5cf6', ordem = 2, tipo_conclusao = 'aberto', dias_limite_estagnado = 2
      WHERE id = v_stage_contato_id;
    ELSE
      INSERT INTO public.crm_estagios (pipeline_id, nome, cor, ordem, tipo_conclusao, dias_limite_estagnado)
      VALUES (r_pipe.id, 'Primeiro Contato', '#8b5cf6', 2, 'aberto', 2)
      RETURNING id INTO v_stage_contato_id;
    END IF;

    -- 4. Renomeia ou cria 'Acompanhamento' (ordem 3)
    SELECT id INTO v_stage_acomp_id FROM public.crm_estagios 
    WHERE pipeline_id = r_pipe.id AND (nome ILIKE '%qualifica%' OR nome ILIKE '%acompanhamento%')
    LIMIT 1;

    IF v_stage_acomp_id IS NOT NULL THEN
      UPDATE public.crm_estagios 
      SET nome = 'Acompanhamento', cor = '#f59e0b', ordem = 3, tipo_conclusao = 'aberto', dias_limite_estagnado = 3
      WHERE id = v_stage_acomp_id;
    ELSE
      INSERT INTO public.crm_estagios (pipeline_id, nome, cor, ordem, tipo_conclusao, dias_limite_estagnado)
      VALUES (r_pipe.id, 'Acompanhamento', '#f59e0b', 3, 'aberto', 3)
      RETURNING id INTO v_stage_acomp_id;
    END IF;

    -- 5. Renomeia ou cria 'Proposta para Reunião' (ordem 4)
    SELECT id INTO v_stage_prop_id FROM public.crm_estagios 
    WHERE pipeline_id = r_pipe.id AND (nome ILIKE '%proposta%' OR nome ILIKE '%reunião%' OR nome ILIKE '%reuniao%')
    LIMIT 1;

    IF v_stage_prop_id IS NOT NULL THEN
      UPDATE public.crm_estagios 
      SET nome = 'Proposta para Reunião', cor = '#6366f1', ordem = 4, tipo_conclusao = 'aberto', dias_limite_estagnado = 3
      WHERE id = v_stage_prop_id;
    ELSE
      INSERT INTO public.crm_estagios (pipeline_id, nome, cor, ordem, tipo_conclusao, dias_limite_estagnado)
      VALUES (r_pipe.id, 'Proposta para Reunião', '#6366f1', 4, 'aberto', 3)
      RETURNING id INTO v_stage_prop_id;
    END IF;

    -- Se existia outra etapa antiga de reunião ou proposta separada, migra negócios para v_stage_prop_id e remove a duplicada
    FOR v_stage_extra_id IN
      SELECT id FROM public.crm_estagios 
      WHERE pipeline_id = r_pipe.id 
        AND id <> v_stage_prop_id 
        AND (nome ILIKE '%reunião agendada%' OR nome ILIKE '%proposta apresentada%')
    LOOP
      UPDATE public.crm_negocios SET estagio_id = v_stage_prop_id WHERE estagio_id = v_stage_extra_id;
      DELETE FROM public.crm_estagios WHERE id = v_stage_extra_id;
    END LOOP;

    -- 6. Renomeia ou cria 'Follow-up' (ordem 5)
    SELECT id INTO v_stage_follow_id FROM public.crm_estagios 
    WHERE pipeline_id = r_pipe.id AND (nome ILIKE '%follow-up%' OR nome ILIKE '%followup%')
    LIMIT 1;

    IF v_stage_follow_id IS NOT NULL THEN
      UPDATE public.crm_estagios 
      SET nome = 'Follow-up', cor = '#ec4899', ordem = 5, tipo_conclusao = 'aberto', dias_limite_estagnado = 2
      WHERE id = v_stage_follow_id;
    ELSE
      INSERT INTO public.crm_estagios (pipeline_id, nome, cor, ordem, tipo_conclusao, dias_limite_estagnado)
      VALUES (r_pipe.id, 'Follow-up', '#ec4899', 5, 'aberto', 2)
      RETURNING id INTO v_stage_follow_id;
    END IF;

    -- 7. Renomeia ou cria 'Fechamento' (ordem 6, ganho)
    SELECT id INTO v_stage_fech_id FROM public.crm_estagios 
    WHERE pipeline_id = r_pipe.id AND (nome ILIKE '%ganho%' OR nome ILIKE '%fechamento%' OR nome ILIKE '%cliente ganho%')
    LIMIT 1;

    IF v_stage_fech_id IS NOT NULL THEN
      UPDATE public.crm_estagios 
      SET nome = 'Fechamento', cor = '#00DC94', ordem = 6, tipo_conclusao = 'ganho', dias_limite_estagnado = 0
      WHERE id = v_stage_fech_id;
    ELSE
      INSERT INTO public.crm_estagios (pipeline_id, nome, cor, ordem, tipo_conclusao, dias_limite_estagnado)
      VALUES (r_pipe.id, 'Fechamento', '#00DC94', 6, 'ganho', 0)
      RETURNING id INTO v_stage_fech_id;
    END IF;

    -- 8. Renomeia ou cria 'Perda' (ordem 7, perdido)
    SELECT id INTO v_stage_perda_id FROM public.crm_estagios 
    WHERE pipeline_id = r_pipe.id AND (nome ILIKE '%perdido%' OR nome ILIKE '%desqualificado%' OR nome ILIKE '%perda%')
    LIMIT 1;

    IF v_stage_perda_id IS NOT NULL THEN
      UPDATE public.crm_estagios 
      SET nome = 'Perda', cor = '#ef4444', ordem = 7, tipo_conclusao = 'perdido', dias_limite_estagnado = 0
      WHERE id = v_stage_perda_id;
    ELSE
      INSERT INTO public.crm_estagios (pipeline_id, nome, cor, ordem, tipo_conclusao, dias_limite_estagnado)
      VALUES (r_pipe.id, 'Perda', '#ef4444', 7, 'perdido', 0)
      RETURNING id INTO v_stage_perda_id;
    END IF;

  END LOOP;
END $$;
