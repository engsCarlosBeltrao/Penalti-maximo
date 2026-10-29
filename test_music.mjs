// Testes do sistema de músicas: validação de links, persistência e gerenciador (com player FALSO — não testa o YouTube real).
import { parseYouTube } from './js/ytUtil.js'; import { Store, sanitize, defaults, uid } from './js/settingsStore.js'; import { AM } from './js/audioManager.js';
import { Events } from './js/events.js'; import { GS } from './js/gameState.js'; import { TEAMS } from './js/teams.js'; import { saveCategory } from './js/rig.js';
let ok = 0, bad = 0; const t = (n, c) => { c ? ok++ : (bad++, console.log('FALHOU:', n)); }; const tick = () => new Promise(r => setTimeout(r, 5));
// ---- links ----
const id = 'dQw4w9WgXcQ';
t('url completa', parseYouTube(`https://www.youtube.com/watch?v=${id}`).id === id);
t('url com params', parseYouTube(`https://www.youtube.com/watch?v=${id}&list=PL123&t=1m30s`).start === 90);
t('youtu.be + t', (r => r.id === id && r.start === 30)(parseYouTube(`https://youtu.be/${id}?t=30`)));
t('shorts', parseYouTube(`https://www.youtube.com/shorts/${id}`).id === id); t('embed', parseYouTube(`https://www.youtube.com/embed/${id}`).id === id);
t('music.youtube', parseYouTube(`https://music.youtube.com/watch?v=${id}`).id === id); t('mobile sem https', parseYouTube(`m.youtube.com/watch?v=${id}`).id === id); t('id puro', parseYouTube(id).id === id);
t('dominio falso', !parseYouTube(`https://evil.com/watch?v=${id}`).ok); t('subdominio enganoso', !parseYouTube(`https://youtube.com.evil.com/watch?v=${id}`).ok); t('vimeo', !parseYouTube('https://vimeo.com/123').ok);
t('javascript:', !parseYouTube('javascript:alert(1)').ok); t('vazio', !parseYouTube('').ok); t('sem id', !parseYouTube('https://www.youtube.com/watch').ok); t('id curto', !parseYouTube('https://www.youtube.com/watch?v=abc').ok);
t('so playlist', (r => !r.ok && /playlist/i.test(r.error))(parseYouTube('https://www.youtube.com/playlist?list=PLabc')));
t('nao usa URL inteira como id', parseYouTube(`https://www.youtube.com/watch?v=${id}`).id.length === 11);
// ---- persistência ----
const mem = {}; globalThis.localStorage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; }, removeItem: k => { delete mem[k]; } };
Store.load(); Store.data.menu.tracks.push({ id: uid(), name: 'A', vid: id, start: 0, vol: 70, enabled: true, cat: 'menu' }); Store.data.chants.flamengo = { id: 'c1', name: 'Canto FLA', vid: 'aaaaaaaaaaa', start: 0, vol: 90, enabled: true, cat: 'canto' }; Store.data.champion.mode = 'exclusive'; Store.save();
Store.data = defaults(); Store.load(); t('persistiu playlist', Store.data.menu.tracks.length === 1 && Store.data.menu.tracks[0].vid === id); t('persistiu canto e modo', Store.data.chants.flamengo?.vol === 90 && Store.data.champion.mode === 'exclusive');
mem.pm_audio_v1 = '{lixo'; Store.load(); t('json corrompido não trava', Store.data.menu.tracks.length === 0 && !!Store.warning);
mem.pm_audio_v1 = JSON.stringify({ menu: { tracks: [{ vid: 'curto' }, { vid: id, vol: 999, name: 'x'.repeat(200) }, null, 5] }, chants: { 'ok-key': { vid: id }, 'Chave Ruim!': { vid: id } }, champion: { mode: 'hack' }, play: { master: 'abc', chantStart: 'x' } }); Store.warning = ''; Store.load();
t('itens inválidos descartados', Store.data.menu.tracks.length === 1 && Store.data.menu.tracks[0].vol === 100 && Store.data.menu.tracks[0].name.length === 60 && Object.keys(Store.data.chants).join() === 'ok-key' && Store.data.champion.mode === 'team' && Store.data.play.master === 80);
Store.save(); Store.reset(); t('restaurar padrão', Store.data.menu.tracks.length === 0); Store.clear(); t('limpar remove chave', !('pm_audio_v1' in mem));
// ---- gerenciador (player falso) ----
let made = 0; class Fake { constructor(ev) { this.ev = ev; this.vid = null; this.vol = null; this.stops = 0; } loadVideoById(o) { this.vid = o.videoId; this.ev.onStateChange({ data: 1 }); } stopVideo() { this.vid = null; this.stops++; } setVolume(v) { this.vol = v; } pauseVideo() { this.ev.onStateChange({ data: 2 }); } playVideo() { this.ev.onStateChange({ data: 1 }); } }
AM.makePlayer = ev => { made++; return Promise.resolve(new Fake(ev)); };
const E = (key, n) => ({ id: 'id-' + key, name: 'Canto ' + key, vid: n.repeat(11), start: 0, vol: 100, enabled: true, cat: 'canto' });
Store.data = defaults(); Store.data.chants.flamengo = E('fla', 'F'); Store.data.chants.vasco = E('vas', 'V'); Store.data.champion.defaultSong = E('def', 'D'); Store.data.champion.exclusive = E('exc', 'X');
GS.equipes = [TEAMS.find(c => c.key === 'flamengo'), TEAMS.find(c => c.key === 'vasco')]; AM.init(); AM.init();
Events.emit('partida_iniciada'); Events.emit('cobranca_mudou', { cobranca: 1, cobrador: 0 }); await tick(); t('Flamengo cobra → canto do Flamengo', AM.player.vid === 'FFFFFFFFFFF');
Events.emit('cobranca_mudou', { cobranca: 1, cobrador: 1 }); await tick(); t('vez do Vasco → troca para o Vasco', AM.player.vid === 'VVVVVVVVVVV'); t('um único player criado', made === 1);
GS.equipes = [GS.equipes[0], TEAMS.find(c => c.key === 'santos')]; Events.emit('cobranca_mudou', { cobranca: 2, cobrador: 1 }); await tick(); t('equipe sem canto → para canto anterior', AM.player.vid === null && !AM.cur);
GS.equipes = [TEAMS.find(c => c.key === 'flamengo'), TEAMS.find(c => c.key === 'vasco')];
Store.data.play.chantStart = 'cobranca'; Events.emit('cobranca_mudou', { cobranca: 3, cobrador: 0 }); await tick(); t('modo cobrança: preparação não toca', AM.player.vid === null); Events.emit('chute', { equipe: 0 }); await tick(); t('modo cobrança: toca no chute', AM.player.vid === 'FFFFFFFFFFF');
t('ducking no chute (100 × 80% × 25% = 20)', AM.player.vol === 20); await new Promise(r => setTimeout(r, 2200)); t('volume restaurado (80)', AM.player.vol === 80);
Store.data.play.chantStart = 'gol'; Events.emit('gol', { equipe: 1 }); await tick(); t('modo gol: canto de quem marcou', AM.player.vid === 'VVVVVVVVVVV');
Store.data.play.chantStart = 'apresentacao'; AM.stop(); Events.emit('partida_iniciada'); await tick(); t('modo apresentação', AM.player.vid === 'FFFFFFFFFFF'); Events.emit('cobranca_mudou', { cobrador: 1 }); await tick(); t('apresentação não troca por turno', AM.player.vid === 'FFFFFFFFFFF');
Store.data.play.chantStart = 'preparacao';
Events.emit('partida_encerrada', { vencedor: 1 }); await tick(); t('campeão: canto do vencedor (Vasco)', AM.player.vid === 'VVVVVVVVVVV' && AM.cur.kind === 'champion');
Events.emit('cobranca_mudou', { cobrador: 0 }); await tick(); t('canto não interrompe campeão (prioridade)', AM.player.vid === 'VVVVVVVVVVV' && AM.cur.kind === 'champion');
Events.emit('partida_reiniciada'); await tick(); t('reinício para campeão', AM.player.vid === null);
Store.data.champion.mode = 'exclusive'; Events.emit('partida_encerrada', { vencedor: 0 }); await tick(); t('campeão: link exclusivo', AM.player.vid === 'XXXXXXXXXXX');
Store.data.champion.mode = 'default'; AM.stop(); Events.emit('partida_encerrada', { vencedor: 0 }); await tick(); t('campeão: música padrão', AM.player.vid === 'DDDDDDDDDDD');
Store.data.champion.mode = 'off'; AM.stop(); Events.emit('partida_encerrada', { vencedor: 0 }); await tick(); t('campeão desativado', AM.player.vid === null);
Store.data.champion.mode = 'team'; AM.stop(); Events.emit('partida_encerrada', { vencedor: null }); await tick(); t('empate/sem vencedor: não toca', AM.player.vid === null);
Events.emit('gol', { equipe: 0 }); await tick(); t('gol comum não toca música de campeão', AM.cur?.kind !== 'champion');
// playlist do menu
Store.data.menu.tracks = ['1', '2', '3'].map(n => ({ id: 'm' + n, name: 'M' + n, vid: n.repeat(11), start: 0, vol: 80, enabled: n !== '2', cat: 'menu' })); AM.stop(); AM.gestured = false; AM.startMenu(); await tick(); t('menu exige interação do usuário', AM.player.vid === null);
AM.userGesture === undefined; AM.gestured = true; GS.estado = 'MENU'; AM.menuI = 0; AM.startMenu(); await tick(); t('menu toca 1ª', AM.player.vid === '11111111111'); AM.menuNext(); await tick(); t('próxima pula desativada', AM.player.vid === '33333333333'); AM.menuPrev(); await tick(); t('anterior', AM.player.vid === '11111111111');
Store.data.menu.repeat = 'one'; AM.player.ev.onStateChange({ data: 0 }); await tick(); t('repetir música', AM.player.vid === '11111111111'); Store.data.menu.repeat = 'all'; AM.player.ev.onStateChange({ data: 0 }); await tick(); t('fim → próxima (repetir playlist)', AM.player.vid === '33333333333');
Store.data.menu.repeat = 'off'; AM.menuI = 1; AM.player.ev.onStateChange({ data: 0 }); await tick(); t('fim sem repetir para', !AM.cur);
Events.emit('cobranca_mudou', { cobrador: 0 }); await tick(); AM.startMenu(); await tick(); t('menu não derruba canto (prioridade)', AM.cur.kind === 'chant');
AM.stop(); AM.startMenu(); await tick(); AM.togglePause(); t('pausar', !AM.playing); AM.togglePause(); t('retomar', AM.playing);
// erros
AM.stop(); AM.menuI = 0; AM.fails = 0; AM.startMenu(); await tick(); AM.player.ev.onError({ data: 101 }); await tick(); t('erro 101 marca status e pula', AM.status.m1.ok === false && /incorporada/.test(AM.status.m1.msg) && AM.player.vid === '33333333333');
AM.player.ev.onError({ data: 100 }); AM.player.ev.onError({ data: 150 }); await tick(); t('todas falham → para sem laço infinito', !AM.cur && !AM.playing);
AM.stop(); const E1 = Store.data.chants.flamengo; AM.test(E1); await tick(); AM.player.ev.onError({ data: 150 }); t('erro em canto: mensagem clara', AM.status[E1.id].ok === false && AM.msg.length > 5);
AM.player = null; AM._p = null; AM.makePlayer = () => Promise.reject(new Error('rede')); AM.test(E1); await tick(); t('sem internet: mensagem, sem travar', /carregar/i.test(AM.msg) && !AM.cur);
t('categorias de defesa', saveCategory(.8, .3) === 'alta' && saveCategory(.1, .3) === 'baixa' && saveCategory(.45, .3) === 'media' && saveCategory(.9, .02) === 'central' && saveCategory(.1, .02) === 'central');
console.log(`MUSICA OK ${ok} | FALHAS ${bad}`); process.exit(bad ? 1 : 0);
