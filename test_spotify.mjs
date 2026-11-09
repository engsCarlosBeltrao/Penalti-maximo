// MÚSICAS E TORCIDAS (Spotify): validação de links, cadastro por clube (adicionar/editar/remover/organizar), persistência no armazenamento existente,
// e abertura FORA do jogo (URI do app do Windows / link do navegador) — sem tocar nada dentro do jogo.  node test_spotify.mjs
import fs from 'fs';
const mem = {}; globalThis.localStorage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
const S = await import('./js/spotify.js'), { Store, defaults } = await import('./js/settingsStore.js');
let ok = 0, bad = 0; const t = (n, c, info = '') => { c ? ok++ : (bad++, console.log('FALHOU:', n, info)); if (c) console.log(`ok  ${n}${info !== '' ? ' · ' + info : ''}`); };
const TR = '4uLU6hMCjMI75M1A2tKUQC', PL = '37i9dQZF1DXcBWIGoYBM5M';
// ---- links ----
const p = S.parseSpotify;
t('faixa: link completo', (r => r.ok && r.tipo === 'track' && r.id === TR && r.uri === `spotify:track:${TR}`)(p(`https://open.spotify.com/track/${TR}`)));
t('faixa: com ?si= e intl-pt', (r => r.ok && r.id === TR)(p(`https://open.spotify.com/intl-pt/track/${TR}?si=abc123`)));
t('faixa: sem https', p(`open.spotify.com/track/${TR}`).ok);
t('playlist: link e URI', p(`https://open.spotify.com/playlist/${PL}`).tipo === 'playlist' && p(`spotify:playlist:${PL}`).url === `https://open.spotify.com/playlist/${PL}`);
t('embed vira link normal', p(`https://open.spotify.com/embed/track/${TR}`).url === `https://open.spotify.com/track/${TR}`);
for (const [n, l] of [['YouTube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'], ['domínio falso', `https://open.spotify.com.evil.com/track/${TR}`], ['outro site com caminho igual', `https://evil.com/track/${TR}`], ['javascript:', 'javascript:alert(1)'], ['vazio', ''], ['texto', 'qualquer coisa'],
  ['álbum', `https://open.spotify.com/album/${TR}`], ['artista', `https://open.spotify.com/artist/${TR}`], ['link curto', 'https://spotify.link/abc'], ['id curto', 'https://open.spotify.com/track/abc'], ['URI de álbum', `spotify:album:${TR}`]])
  t(`inválido: ${n}`, !p(l).ok && !!p(l).error, p(l).error);
// ---- cadastro por clube ----
const L = {};
t('adicionar faixa no Flamengo', S.adicionar(L, 'flamengo', `https://open.spotify.com/track/${TR}`, 'Hino').ok && L.flamengo.length === 1 && L.flamengo[0].nome === 'Hino');
t('adicionar playlist no Flamengo (nome do oEmbed)', S.adicionar(L, 'flamengo', `spotify:playlist:${PL}`, '', { nome: 'Raça', capa: 'https://i.scdn.co/image/abc' }).ok && L.flamengo[1].nome === 'Raça' && L.flamengo[1].capa === 'https://i.scdn.co/image/abc');
t('não duplica o mesmo link no clube', !S.adicionar(L, 'flamengo', `https://open.spotify.com/track/${TR}?si=x`).ok && L.flamengo.length === 2);
t('o mesmo link em OUTRO clube é independente', S.adicionar(L, 'corinthians', `https://open.spotify.com/track/${TR}`, 'Timão').ok && L.corinthians.length === 1 && L.flamengo.length === 2);
t('link inválido não entra', !S.adicionar(L, 'palmeiras', 'https://youtube.com/x').ok && !L.palmeiras);
t('capa só da CDN do Spotify (outra origem é descartada)', S.limpaEntrada({ uri: `spotify:track:${TR}`, capa: 'https://evil.com/x.png' }).capa === '');
const id0 = L.flamengo[0].id, id1 = L.flamengo[1].id;
t('organizar: ▼ e ▲', S.mover(L, 'flamengo', id0, 1) && L.flamengo[1].id === id0 && S.mover(L, 'flamengo', id0, -1) && L.flamengo[0].id === id0 && !S.mover(L, 'flamengo', id0, -1));
t('editar nome', S.editar(L, 'flamengo', id0, { nome: 'Hino Oficial' }).ok && L.flamengo[0].nome === 'Hino Oficial');
t('editar link (vira outra faixa) e recusar link inválido', S.editar(L, 'flamengo', id0, { link: 'https://open.spotify.com/track/0000000000000000000000' }).ok && L.flamengo[0].sid === '0000000000000000000000' && !S.editar(L, 'flamengo', id0, { link: 'https://x.com/a' }).ok);
t('editar para um link já cadastrado no clube é recusado', !S.editar(L, 'flamengo', id0, { link: `spotify:playlist:${PL}` }).ok);
t('remover', S.remover(L, 'flamengo', id1) && L.flamengo.length === 1 && L.corinthians.length === 1);
// ---- persistência (settingsStore, chave pm_audio_v1, junto com as configurações que já existiam) ----
Store.load(); Store.data.spotify = JSON.parse(JSON.stringify(L)); Store.data.play.master = 55; Store.save();
Store.data = defaults(); Store.load();
t('persistiu os links de cada clube', Store.data.spotify.flamengo?.[0]?.nome === 'Hino Oficial' && Store.data.spotify.corinthians?.[0]?.nome === 'Timão');
t('as configurações de áudio antigas continuam salvas', Store.data.play.master === 55);
mem.pm_audio_v1 = JSON.stringify({ spotify: { flamengo: [{ uri: `spotify:track:${TR}`, nome: 'ok' }, { uri: 'lixo' }, null], 'Chave Ruim!': [{ uri: `spotify:track:${TR}` }], santos: 'x' } }); Store.load();
t('dados inválidos descartados sem travar', Store.data.spotify.flamengo.length === 1 && Object.keys(Store.data.spotify).join() === 'flamengo' && Store.warning.length > 0);
mem.pm_audio_v1 = '{lixo'; Store.load(); t('JSON corrompido não trava', JSON.stringify(Store.data.spotify) === '{}');
// ---- abrir fora do jogo ----
const e = { tipo: 'track', sid: TR };
{ let foi = null, ouv = {}; const w = { location: { assign: u => { foi = u; ouv.blur?.(); } }, addEventListener: (n, f) => { ouv[n] = f; }, removeEventListener: () => {}, document: { hasFocus: () => true } };
  const r = await S.abrirNoApp(e, w); t('ABRIR NO SPOTIFY usa a URI oficial do app (spotify:track:ID) e detecta que o app abriu', foi === `spotify:track:${TR}` && r === true, foi); }
{ const w = { location: { assign: () => {} }, addEventListener: () => {}, removeEventListener: () => {}, document: { hasFocus: () => true } };
  t('app não respondeu (não instalado): avisa para usar o navegador', (await S.abrirNoApp(e, w)) === false); }
{ let foi = null; const w = { open: (u, a, b) => { foi = [u, a, b]; return null; } }; S.abrirNoNavegador(e, w); t('NAVEGADOR abre https://open.spotify.com/track/ID em outra aba', foi[0] === `https://open.spotify.com/track/${TR}` && foi[1] === '_blank' && foi[2] === 'noopener'); }
{ let url = null; const meta = await S.buscaMeta(`spotify:track:${TR}`, async u => { url = u; return { ok: true, json: async () => ({ title: 'Nome', author_name: '', thumbnail_url: 'https://image-cdn-ak.spotifycdn.com/image/x' }) }; });
  t('nome e capa pelo oEmbed público oficial (open.spotify.com/oembed)', url.startsWith('https://open.spotify.com/oembed?url=') && meta.nome === 'Nome' && meta.capa.startsWith('https://image-cdn-ak.spotifycdn.com/'));
  t('oEmbed fora do ar: segue sem capa', (await S.buscaMeta(`spotify:track:${TR}`, async () => { throw new Error('rede'); })) === null); }
// ---- nada do Spotify dentro do jogo ----
const main = fs.readFileSync('js/main.js', 'utf8'), game = fs.readFileSync('js/game.js', 'utf8'), sp = fs.readFileSync('js/spotify.js', 'utf8') + fs.readFileSync('js/spotifyPanel.js', 'utf8');
t('o jogo não inicia mais o player do YouTube nem toca música externa na partida', !/AM\.init\(\)|audioManager\.js'/.test(main) && !/spotify/i.test(game));
t('cadastro e links sem API/SDK/download; a API oficial (Player) fica só em js/spotifyControle.js, sem SDK e sem baixar áudio', !/api\.spotify\.com|sdk\.scdn\.co|Spotify\.Player|new Audio|accounts\.spotify/.test(sp) && (c => !/sdk\.scdn\.co|Spotify\.Player|new Audio|\/tracks\/|\/audio-/.test(c) && /api\.spotify\.com\/v1/.test(c))(fs.readFileSync('js/spotifyControle.js', 'utf8')));
console.log(`SPOTIFY OK ${ok} | FALHAS ${bad}`); process.exit(bad ? 1 : 0);
