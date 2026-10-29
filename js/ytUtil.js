// Validação de links do YouTube: aceita só domínios do YouTube e extrai o ID de 11 caracteres (nunca usa a URL inteira como ID).
const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be', 'www.youtu.be']);
const ID = /^[A-Za-z0-9_-]{11}$/;
function parseTime(s) {                                  // 90 | 90s | 1m30s | 1h2m3s
  if (!s) return 0; if (/^\d+$/.test(s)) return +s;
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(s); if (!m || !(m[1] || m[2] || m[3])) return 0; return (+m[1] || 0)*3600 + (+m[2] || 0)*60 + (+m[3] || 0);
}
export const watchUrl = id => `https://www.youtube.com/watch?v=${id}`;
export function parseYouTube(input) {
  const raw = String(input ?? '').trim(); if (!raw) return { ok: false, error: 'Cole um link do YouTube.' };
  if (ID.test(raw)) return { ok: true, id: raw, start: 0, url: watchUrl(raw) };      // ID puro (11 caracteres)
  let u; try { u = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw); } catch { return { ok: false, error: 'Link inválido.' }; }
  if (!/^https?:$/.test(u.protocol) || !HOSTS.has(u.hostname.toLowerCase())) return { ok: false, error: 'Só são aceitos links do YouTube (youtube.com, youtu.be).' };
  const h = u.hostname.toLowerCase(), parts = u.pathname.split('/').filter(Boolean); let id = null;
  if (h.endsWith('youtu.be')) id = parts[0]; else if (parts[0] === 'watch') id = u.searchParams.get('v'); else if (['embed', 'shorts', 'live', 'v'].includes(parts[0])) id = parts[1];
  if (!id || !ID.test(id)) return { ok: false, error: !id && u.searchParams.get('list') ? 'Links apenas de playlist não são suportados: cole o link de um vídeo.' : 'Não encontrei um ID de vídeo válido neste link.' };
  return { ok: true, id, start: parseTime(u.searchParams.get('t') || u.searchParams.get('start')), url: watchUrl(id) };
}
