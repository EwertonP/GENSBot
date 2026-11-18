import { describe, expect, it } from 'vitest';
import { decidirEnvio, dentroDoHorario, sortearAtrasoSegundos, type FatosDoEnvio } from './regras';

// 23/11/2026 é segunda. 12:00Z = 09:00 em São Paulo.
const seg9h = new Date('2026-11-23T12:00:00Z');
const horario = { seg: [{ de: '08:00', ate: '19:00' }] };

const base = (o: Partial<FatosDoEnvio> = {}): FatosDoEnvio => ({
  agora: seg9h,
  criadoEm: new Date(seg9h.getTime() - 120_000),
  ligado: true,
  horario,
  limiteRespostasHora: 12,
  pausaHumanoHoras: 6,
  respostasUltimaHora: 0,
  ultimaDoPaciente: new Date(seg9h.getTime() - 300_000),
  ultimaDoHumano: null,
  ...o,
});

describe('dentroDoHorario', () => {
  it('usa o horário de São Paulo, não o UTC', () => {
    expect(dentroDoHorario(horario, new Date('2026-11-23T12:00:00Z'))).toBe(true); // 09h
    expect(dentroDoHorario(horario, new Date('2026-11-23T05:00:00Z'))).toBe(false); // 02h
    expect(dentroDoHorario(horario, new Date('2026-11-23T22:00:00Z'))).toBe(false); // 19h exato: fim não vale
  });
  it('dia sem faixa e horário vazio ou ausente não respondem', () => {
    expect(dentroDoHorario(horario, new Date('2026-11-24T15:00:00Z'))).toBe(false); // terça
    expect(dentroDoHorario({}, seg9h)).toBe(false);
    expect(dentroDoHorario(null, seg9h)).toBe(false);
  });
});

describe('sortearAtrasoSegundos', () => {
  it('fica entre o mínimo e o máximo', () => {
    expect(sortearAtrasoSegundos(45, 180, 0)).toBe(45);
    expect(sortearAtrasoSegundos(45, 180, 0.999)).toBe(180);
    expect(sortearAtrasoSegundos(60, 60, 0.5)).toBe(60);
  });
});

describe('decidirEnvio', () => {
  it('tudo em ordem: envia', () => expect(decidirEnvio(base())).toEqual({ acao: 'enviar' }));
  it('desligado descarta', () => expect(decidirEnvio(base({ ligado: false }))).toEqual({ acao: 'descartar', motivo: 'atendimento_desligado' }));
  it('nunca puxa conversa: paciente sem mensagem recente', () => {
    expect(decidirEnvio(base({ ultimaDoPaciente: null }))).toMatchObject({ motivo: 'paciente_nao_escreveu' });
    expect(decidirEnvio(base({ ultimaDoPaciente: new Date(seg9h.getTime() - 25 * 3600_000), criadoEm: new Date(seg9h.getTime() - 24 * 3600_000) }))).toMatchObject({ motivo: 'paciente_nao_escreveu' });
  });
  it('mensagem nova do paciente depois da resposta montada: descarta', () => {
    expect(decidirEnvio(base({ ultimaDoPaciente: new Date(seg9h.getTime() - 60_000) }))).toMatchObject({ motivo: 'paciente_escreveu_depois' });
  });
  it('secretária respondeu há pouco: pausa; passada a janela, volta', () => {
    expect(decidirEnvio(base({ ultimaDoHumano: new Date(seg9h.getTime() - 3600_000) }))).toMatchObject({ motivo: 'humano_assumiu' });
    expect(decidirEnvio(base({ ultimaDoHumano: new Date(seg9h.getTime() - 7 * 3600_000) }))).toEqual({ acao: 'enviar' });
  });
  it('fora do horário espera; velha demais expira', () => {
    const noite = new Date('2026-11-23T05:00:00Z');
    expect(decidirEnvio(base({ agora: noite, criadoEm: new Date(noite.getTime() - 60_000), ultimaDoPaciente: new Date(noite.getTime() - 120_000) }))).toEqual({ acao: 'esperar', motivo: 'fora_do_horario' });
    expect(decidirEnvio(base({ criadoEm: new Date(seg9h.getTime() - 13 * 3600_000), ultimaDoPaciente: new Date(seg9h.getTime() - 14 * 3600_000) }))).toMatchObject({ motivo: 'expirou' });
  });
  it('limite por hora espera', () => {
    expect(decidirEnvio(base({ respostasUltimaHora: 12 }))).toEqual({ acao: 'esperar', motivo: 'limite_por_hora' });
    expect(decidirEnvio(base({ limiteRespostasHora: 0 }))).toEqual({ acao: 'esperar', motivo: 'limite_por_hora' });
  });
});
