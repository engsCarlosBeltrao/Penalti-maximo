// ARQUIVOS DE ÁUDIO DAS TORCIDAS: o navegador não guarda o caminho de um arquivo do computador, então o próprio áudio (MP3/WAV/OGG escolhido pelo
// usuário) fica no IndexedDB do jogo e continua disponível nas próximas partidas. Sem IndexedDB (ou em testes), guarda só em memória nesta sessão.
const DB = 'pm_torcidas', ST = 'arquivos';
export const FORMATOS = { mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', m4a: 'audio/mp4' };
export const MAX_MB = 30;
export const ACEITA = '.mp3,.wav,.ogg,.oga,.m4a,audio/mpeg,audio/wav,audio/x-wav,audio/ogg,audio/mp4';
// arquivo aceito? (extensão conhecida + tipo de áudio, tamanho até 30 MB; se o navegador disser que não toca o formato, recusa)
export function validaArquivo(f, podeTocar = null) {
  if (!f || typeof f.name !== 'string') return { ok: false, error: 'Nenhum arquivo.' };
  const ext = (f.name.split('.').pop() || '').toLowerCase(), mime = FORMATOS[ext];
  if (!mime) return { ok: false, error: `${f.name}: formato não aceito (use MP3, WAV ou OGG).` };
  if (f.type && !/^audio\//.test(f.type) && f.type !== 'application/ogg') return { ok: false, error: `${f.name}: não é um arquivo de áudio.` };
  if (!(f.size > 0)) return { ok: false, error: `${f.name}: arquivo vazio.` };
  if (f.size > MAX_MB*1024*1024) return { ok: false, error: `${f.name}: maior que ${MAX_MB} MB.` };
  if (podeTocar && !podeTocar(f.type || mime)) return { ok: false, error: `${f.name}: este navegador não toca esse formato.` };
  return { ok: true, mime: f.type || mime, ext };
}
const mem = new Map(); let dbp = null;
const idb = () => typeof indexedDB === 'undefined' ? null : (dbp ??= new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(ST); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }).catch(() => null));
const tx = async (modo, fn) => { const db = await idb(); if (!db) return null; return new Promise((res, rej) => { const t = db.transaction(ST, modo), s = t.objectStore(ST), r = fn(s); t.oncomplete = () => res(r?.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); };
export const Arquivos = {
  persistente: () => typeof indexedDB !== 'undefined',
  async guardar(id, blob) { mem.set(id, blob); try { await tx('readwrite', s => s.put(blob, id)); return true; } catch { return false; } },
  async ler(id) { if (mem.has(id)) return mem.get(id); try { const b = await tx('readonly', s => s.get(id)); if (b) mem.set(id, b); return b || null; } catch { return null; } },
  async apagar(id) { mem.delete(id); try { await tx('readwrite', s => s.delete(id)); } catch {} },
  async ids() { try { const k = await tx('readonly', s => s.getAllKeys()); return k || [...mem.keys()]; } catch { return [...mem.keys()]; } },
  _mem: mem
};
