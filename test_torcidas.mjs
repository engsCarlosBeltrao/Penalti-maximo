// MÚSICAS DAS TORCIDAS (arquivos locais tocados pelo jogo): validação de arquivos, cadastro por clube, principal, persistência, e o PLAYER ÚNICO ligado
// aos eventos reais da partida (início, troca de equipe, chute, gol, pausa, fim) — com um <audio> FALSO (node não toca som).  node test_torcidas.mjs
const mem = {}; globalThis.localStorage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
const T = await import('./js/torcidas.js'), { Arquivos, validaArquivo } = await import('./js/torcidaArquivos.js'), { Store, defaults } = await import('./js/settingsStore.js');
const { Events } = await import('./js/events.js'), { GS } = await import('./js/gameState.js');
let ok = 0, bad = 0; const t = (n, c, info = '') => { c ? ok++ : (bad++, console.log('FALHOU:', n, info)); if (c) console.log(`ok  ${n}${info !== '' ? ' · ' + info : ''}`); };
const tick = () => new Promise(r => setTimeout(r, 5));
// ---- arquivos ----
const arq = (name, size = 1000, type = '') => ({ name, size, type });
t('aceita MP3, WAV e OGG', ['a.mp3', 'b.WAV', 'c.ogg'].every(n => validaArquivo(arq(n)).ok));
t('recusa outro formato, vazio, grande demais e não-áudio', !validaArquivo(arq('x.txt')).ok && !validaArquivo(arq('x.mp3', 0)).ok && !validaArquivo(arq('x.mp3', 31*1024*1024)).ok && !validaArquivo(arq('x.mp3', 10, 'text/plain')).ok);
t('recusa formato que o navegador não toca', !validaArquivo(arq('x.ogg', 10, 'audio/ogg'), () => false).ok);
// ---- cadastro ----
const L = {};
const a1 = T.adiciona(L, 'flamengo', { nome: 'Hino', arquivo: 'hino.mp3' }).entrada, a2 = T.adiciona(L, 'flamengo', { arquivo: 'raca.ogg' }).entrada, c1 = T.adiciona(L, 'corinthians', { arquivo: 'timao.wav' }).entrada;
t('várias músicas por clube, cada clube com a sua lista', L.flamengo.length === 2 && L.corinthians.length === 1 && a2.nome === 'raca');
t('a 1ª música do clube vira a principal', a1.principal && !a2.principal && c1.principal);
t('escolher a principal', T.principal(L, 'flamengo', a2.id) && L.flamengo.find(x => x.principal).id === a2.id && T.ordemTocar(L, 'flamengo')[0].id === a2.id);
t('editar nome', T.renomeia(L, 'flamengo', a1.id, 'Hino Oficial') && L.flamengo[0].nome === 'Hino Oficial' && !T.renomeia(L, 'flamengo', a1.id, '   '));
// ---- persistência ----
Store.load(); Store.data.torcidas = JSON.parse(JSON.stringify(L)); Store.data.torcidaRegras.fim = 'parar'; Store.data.play.master = 44; Store.save(); Store.data = defaults(); Store.load();
t('cadastro e regras persistem (junto com as configurações que já existiam)', Store.data.torcidas.flamengo?.length === 2 && Store.data.torcidaRegras.fim === 'parar' && Store.data.play.master === 44);
mem.pm_audio_v1 = JSON.stringify({ torcidas: { flamengo: [{ id: 'tabc1', nome: 'ok' }, { id: 'ruim' }, null], 'X!': [] }, torcidaRegras: { fim: 'explodir', volume: 9 } }); Store.load();
t('dados inválidos descartados sem travar', Store.data.torcidas.flamengo.length === 1 && Store.data.torcidas.flamengo[0].principal && Store.data.torcidaRegras.fim === 'vencedor' && Store.data.torcidaRegras.volume === 1);
// ---- player (áudio falso) ----
const vivos = new Set(); let criados = 0;
class FakeAudio { constructor() { criados++; this.paused = true; this.volume = 1; this.currentTime = 0; } set src(v) { this._src = v; } get src() { return this._src; } play() { this.paused = false; vivos.add(this); return Promise.resolve(); } pause() { this.paused = true; vivos.delete(this); } }
Store.data = defaults(); Store.data.torcidas = { flamengo: [], corinthians: [] }; const LS = Store.data.torcidas;
for (const [c, n] of [['flamengo', 'Fla 1'], ['flamengo', 'Fla 2'], ['corinthians', 'Tim 1']]) { const e = T.adiciona(LS, c, { nome: n, arquivo: n + '.mp3' }).entrada; await Arquivos.guardar(e.id, { blob: n }); }
let outrasPausadas = 0; const P = T.criaPlayer({ store: () => Store.data, Audio: FakeAudio, url: b => 'blob:' + b.blob, livre: () => {}, pausaOutras: () => outrasPausadas++ });
GS.equipes = [{ key: 'flamengo' }, { key: 'corinthians' }]; GS.cobrador = 0; P.liga(Events, GS);
const tocando = () => `${P.estado}:${P.faixa?.nome ?? '-'}`;
Events.emit('partida_iniciada', { equipes: GS.equipes }); await tick(); t('início da partida: toca a música do time que entra (Flamengo, a principal)', tocando() === 'tocando:Fla 1' && outrasPausadas > 0, tocando());
const n0 = P.tocadas; Events.emit('cobranca_mudou', { cobrador: 0 }); Events.emit('cobranca_mudou', { cobrador: 0 }); await tick();
t('evento repetido do mesmo time não recomeça nem duplica', P.tocadas === n0 && tocando() === 'tocando:Fla 1');
Events.emit('cobranca_mudou', { cobrador: 1 }); await tick(); t('mudança de equipe: troca para a música do Corinthians', tocando() === 'tocando:Tim 1', tocando());
t('nunca duas músicas ao mesmo tempo (um só elemento de áudio)', criados === 1 && vivos.size === 1);
t('padrão: na cobrança a música NÃO abaixa (toca o tempo todo)', Store.data.torcidaRegras.chute === 'nada'); Store.data.torcidaRegras.chute = 'abaixar'; Events.emit('chute', { equipe: 1 }); t('regra opcional \baixar\: no chute a música abaixa', P._el.volume < .3); Events.emit('defesa', { equipe: 1 }); t('depois do lance volta ao volume', Math.abs(P._el.volume - .7) < 1e-9); Store.data.torcidaRegras.chute = 'nada';
Events.emit('gol', { equipe: 0 }); await tick(); t('gol do Flamengo: toca a música do Flamengo', tocando() === 'tocando:Fla 1', tocando());
// A MÚSICA SEGUE A TORCIDA QUE COMEMORA: só troca quando a OUTRA torcida passa a comemorar
{ const n1 = P.tocadas; Events.emit('cobranca_mudou', { cobrador: 1 }); await tick(); t('comemorando: na vez do adversário a música do Flamengo CONTINUA', tocando() === 'tocando:Fla 1' && P.tocadas === n1, tocando());
  Events.emit('fora', { equipe: 1 }); await tick(); t('o adversário perdeu o pênalti: continua a mesma, sem recomeçar', tocando() === 'tocando:Fla 1' && P.tocadas === n1, tocando());
  Events.emit('cobranca_mudou', { cobrador: 0 }); await tick(); t('próxima vez do Flamengo: continua', tocando() === 'tocando:Fla 1' && P.tocadas === n1);
  Events.emit('defesa', { equipe: 0 }); await tick(); t('o goleiro do Corinthians defendeu: troca para a música do Corinthians', tocando() === 'tocando:Tim 1', tocando());
  Events.emit('cobranca_mudou', { cobrador: 1 }); await tick(); Events.emit('cobranca_mudou', { cobrador: 0 }); await tick(); t('…e ela continua nas vezes seguintes', tocando() === 'tocando:Tim 1', tocando());
  Events.emit('trave', { equipe: 0 }); await tick(); t('o Flamengo bateu na trave: a do Corinthians segue', tocando() === 'tocando:Tim 1');
  Events.emit('gol', { equipe: 0 }); await tick(); t('gol do Flamengo: agora sim volta a do Flamengo', tocando() === 'tocando:Fla 1', tocando()); }
Events.emit('pausa'); t('pausa da partida: música pausa (regra "pausar")', P.estado === 'pausado' && vivos.size === 0);
Events.emit('retomada'); await tick(); t('retomada: continua de onde parou', P.estado === 'tocando' && tocando() === 'tocando:Fla 1');
Store.data.torcidaRegras.pausa = 'abaixar'; Events.emit('pausa'); t('regra "abaixar" na pausa', P.estado === 'tocando' && P._el.volume < .3); Events.emit('retomada'); Store.data.torcidaRegras.pausa = 'pausar';
await P.trocar(); t('trocar música (próxima do mesmo clube)', tocando() === 'tocando:Fla 2', tocando());
t('pausar / continuar manual', P.pausar() && P.estado === 'pausado' && (await P.continuar()) && P.estado === 'tocando');
Store.data.torcidaRegras.volume = .4; P.atualizaVolume(); t('volume', Math.abs(P._el.volume - .4) < 1e-9); Store.data.torcidaRegras.volume = .7; P.atualizaVolume();
P._el.onended(); await tick(); t('repetir "todas": ao terminar, segue para a próxima do clube', tocando() === 'tocando:Fla 1', tocando());
Store.data.torcidaRegras.repetir = 'uma'; P._el.currentTime = 50; P._el.onended(); t('repetir "uma": recomeça a mesma', P._el.currentTime === 0 && tocando() === 'tocando:Fla 1'); Store.data.torcidaRegras.repetir = 'todas';
Events.emit('partida_encerrada', { vencedor: 1 }); await tick(); t('fim (regra "vencedor"): toca a música do time vencedor', tocando() === 'tocando:Tim 1', tocando());
Store.data.torcidaRegras.fim = 'parar'; Events.emit('partida_encerrada', { vencedor: 0 }); t('fim (regra "parar")', P.estado === 'parado' && vivos.size === 0);
Store.data.torcidaRegras = T.REGRAS_PADRAO(); Store.data.torcidaRegras.inicio = false; Store.data.torcidaRegras.vez = false; Events.emit('partida_iniciada', {}); Events.emit('cobranca_mudou', { cobrador: 1 }); await tick();
t('eventos desligados não tocam', P.estado === 'parado'); Store.data.torcidaRegras = T.REGRAS_PADRAO();
GS.equipes = [{ key: 'santos' }, { key: 'flamengo' }]; Events.emit('partida_iniciada', {}); await tick(); t('clube sem música: fica em silêncio, sem erro', P.estado === 'parado' && /Sem música/.test(P.motivo));
Events.emit('cobranca_mudou', { cobrador: 1 }); await tick(); t('…e na vez do outro time toca a dele', tocando() === 'tocando:Fla 1');
{ const pa = P.tocarClube('corinthians', { forcar: true }), pb = P.tocarClube('flamengo', { forcar: true }); await pa; await pb; await tick(); t('dois pedidos seguidos: só o último toca', tocando() === 'tocando:Fla 1' && vivos.size === 1, tocando()); }
await Arquivos.apagar(LS.flamengo[0].id); P.parar(); await P.tocarClube('flamengo'); t('arquivo apagado: mostra erro claro, não trava', P.estado === 'erro' && /não encontrado/.test(P.motivo));
const rem = T.tira(LS, 'flamengo', LS.flamengo[0].id); t('remover a principal passa a principal para a próxima', rem && LS.flamengo.length === 1 && LS.flamengo[0].principal);
// ---- MENU ALEATÓRIO ----
{ Store.data = defaults(); Store.data.torcidas = {}; const LM = Store.data.torcidas;
  for (const n of ['M1', 'M2', 'M3', 'M4']) { const e = T.adiciona(LM, 'menu', { nome: n, arquivo: n + '.mp3' }).entrada; await Arquivos.guardar(e.id, { blob: n }); }
  const PM = T.criaPlayer({ store: () => Store.data, Audio: FakeAudio, url: b => 'blob:' + b.blob, livre: () => {}, pausaOutras: () => {} });
  const primeiras = new Set(); let repetiuAoVoltar = 0, ultima = null;
  for (let i = 0; i < 30; i++) { PM.parar(); await PM.tocarMenu(); await tick(); primeiras.add(PM.faixa.nome); if (PM.faixa.nome === ultima) repetiuAoVoltar++; ultima = PM.faixa.nome; }
  t('menu: a primeira música é sorteada (varia entre as aberturas)', primeiras.size >= 3, [...primeiras].join(','));
  t('menu: ao voltar ao menu não repete a última que tocou', repetiuAoVoltar === 0);
  const seq = [PM.faixa.nome]; for (let i = 0; i < 24; i++) { PM._el.onended(); await tick(); seq.push(PM.faixa.nome); }
  t('menu: quando a música acaba entra outra sorteada, nunca a mesma em seguida', seq.every((n, i) => !i || n !== seq[i - 1]) && new Set(seq).size === 4, seq.join(' '));
  t('menu: em 4 seguidas tocam as 4 músicas (sorteio sem repetir na volta)', new Set(seq.slice(0, 4)).size === 4, seq.slice(0, 4).join(' '));
  const ordens = new Set(); for (let v = 0; v < 6; v++) ordens.add(seq.slice(v*4, v*4 + 4).join()); t('menu: cada volta sai em ordem diferente', ordens.size >= 3); }
console.log(`TORCIDAS OK ${ok} | FALHAS ${bad}`); process.exit(bad ? 1 : 0);
