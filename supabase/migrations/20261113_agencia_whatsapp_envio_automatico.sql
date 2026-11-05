-- Migration: 20261113_agencia_whatsapp_envio_automatico.sql
-- Adiciona a coluna para controle de envio automático pelo WhatsApp (padrão: false / inativo)

alter table if exists public.agencias
  add column if not exists whatsapp_envio_automatico boolean not null default false;
