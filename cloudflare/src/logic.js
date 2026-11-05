export const STATES = Object.freeze({
  PENDING: "pending_payment",
  CONFIRMED: "confirmed",
  WAITLIST: "waitlist",
  INTEREST: "interest",
  GOALKEEPER: "goalkeeper_pending",
  EXPIRED: "expired",
  CANCELLED: "cancelled"
});

export const TIMESTAMP = /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?(?:Z|[+-]\\d{2}:\\d{2})$/;

export function normalizeDate(input) {
  if (typeof input !== "string" || !TIMESTAMP.test(input)) throw new Error("Informe data com fuso horário ISO 8601 (ex.: 2026-11-12T15:00:00Z)");
  const t = Date.parse(input);
  if (!Number.isFinite(t)) throw new Error("Data inválida");
  return new Date(t).toISOString();
}

export function validateMatch(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Dados da partida inválidos");
  const title = String(raw.title ?? "").trim();
  const venue = String(raw.venue ?? "").trim();
  if (title.length < 3 || title.length > 100) throw new Error("Título deve ter 3 a 100 caracteres");
  if (venue.length < 3 || venue.length > 150) throw new Error("Local deve ter 3 a 150 caracteres");
  const starts_at = normalizeDate(raw.starts_at);
  const opens_at = normalizeDate(raw.opens_at);
  const payment_deadline_at = normalizeDate(raw.payment_deadline_at);
  const queue_release_at = normalizeDate(raw.queue_release_at);
  const interest_closes_at = normalizeDate(raw.interest_closes_at);
  const times = [opens_at, payment_deadline_at, queue_release_at, interest_closes_at, starts_at];
  if (times[0] > times[1] || times[1] > times[2] || times[2] > times[4] || times[0] > times[3] || times[3] > times[4])
    throw new Error("Verifique a ordem entre abertura, Pix, liberação da fila e partida");
  const capacity_outfield = Number(raw.capacity_outfield);
  const max_goalkeepers = Number(raw.max_goalkeepers ?? 2);
  const price_cents = Number(raw.price_cents ?? 1500);
  const queue_payment_minutes = Number(raw.queue_payment_minutes ?? 30);
  if (!Number.isSafeInteger(capacity_outfield) || capacity_outfield < 1) throw new Error("Capacidade dos jogadores de linha inválida");
  if (!Number.isSafeInteger(max_goalkeepers) || max_goalkeepers < 0) throw new Error("Quantidade de goleiros inválida");
  if (!Number.isSafeInteger(price_cents) || price_cents < 0) throw new Error("Valor inválido");
  if (!Number.isSafeInteger(queue_payment_minutes) || queue_payment_minutes < 5 || queue_payment_minutes > 1440) throw new Error("Prazo dos convocados deve ser de 5 a 1440 minutos");
  return {title,venue,starts_at,opens_at,payment_deadline_at,queue_release_at,interest_closes_at,capacity_outfield,max_goalkeepers,price_cents,queue_payment_minutes};
}

export function registrationStatus({now, match, occupied, confirmed, isGoalkeeper}) {
  if (new Date(now).getTime() < new Date(match.opens_at).getTime()) return {status:"closed",message:"Inscrições ainda não abertas"};
  if (new Date(now).getTime() >= new Date(match.starts_at).getTime()) return {status:"closed",message:"Partida iniciada"};
  if (isGoalkeeper) return {status:STATES.GOALKEEPER,message:"Goleiro aguardando aprovação do Master"};
  if (occupied < match.capacity_outfield) return {status:STATES.PENDING,message:"Aguardando pagamento"};
  if (confirmed >= match.capacity_outfield) {
    return new Date(now).getTime() <= new Date(match.interest_closes_at).getTime()
      ? {status:STATES.INTEREST,message:"Vagas pagas: somente registro histórico"}
      : {status:"closed",message:"Prazo para registrar interesse encerrado"};
  }
  return {status:STATES.WAITLIST,message:"Lista de espera"};
}

export function paymentDue(now, minutes) {
  return new Date(Date.parse(now) + Number(minutes) * 60_000).toISOString();
}
