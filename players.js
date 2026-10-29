// Elencos. SÓ entram aqui jogadores com vínculo verificado em fonte (campo `source`) e data da fonte (`asOf`).
// Não presumir que o vínculo continua válido: `asOf` antigo = numeração/vínculo daquela data (pode ter mudado).
// position: null quando a fonte não informa (não inventamos). Clubes sem dados verificados usam cobradores "pendentes".
// rating: avaliação 1–99 definida por ESTE projeto (equilíbrio de jogo); influencia levemente o alcance do goleiro.
const WIKI_SAN = 'Wikipedia "2026 Santos FC season", elenco em 08/10/2026 (fontes citadas lá: santosfc.com.br e FPF)';
const NETFLU = 'Netflu, "Fluminense divulga numeração de atletas para 2026" (lista oficial do clube, 14/01/2026)';
const BEM_PR = 'Bem Paraná, "Athletico divulga numeração das camisas" (numeração fixa 2026, jan/2026)';
const P = (id, name, clubId, jerseyNumber, position, o = {}) => ({ id, name, nickname: o.nick, clubId, jerseyNumber, position, isStar: !!o.star, rating: o.rating ?? 75,
  preferredFoot: o.foot, celebration: o.cel || 'normal', personality: o.pers || ['normal'], appearance: o.look || { skinTone: jerseyNumber % 4, hairStyle: 'short' }, source: o.src, asOf: o.asOf });
export const PLAYERS = [
 // ---- Santos ----
 { id:'santos-neymar', name:'Neymar Jr.', nickname:'Neymar', clubId:'santos', jerseyNumber:10, position:'Atacante', isStar:true, rating:92, preferredFoot:'right', celebration:'confident', personality:['star','confident'], appearance:{ skinTone:1, hairStyle:'short' },
   source:'Itatiaia, 2026: "Camisa 10 do Santos"; contrato renovado até o fim de 2026 (Band, jan/2026)', asOf:'2026-01', verifiedAt:'2026-10-13' },
 { id:'santos-gabigol', name:'Gabriel Barbosa', nickname:'Gabigol', clubId:'santos', jerseyNumber:9, position:'Atacante', isStar:true, rating:88, preferredFoot:'left', celebration:'arms', personality:['star','celebrator'], appearance:{ skinTone:1, hairStyle:'short' },
   source:WIKI_SAN + ' (ST, camisa 9, empréstimo do Cruzeiro até 31/12/2026); Tribuna de Jundiaí, 19/09/2026', asOf:'2026-10-08' },
 P('santos-coutinho','Philippe Coutinho','santos',11,'Meia',{ star:true, rating:84, nick:'Coutinho', cel:'crest', pers:['star','confident'], src:WIKI_SAN + ' (AM, camisa 11, agente livre, chegou em 14/09/2026)', asOf:'2026-10-08' }),
 P('santos-menino','Gabriel Menino','santos',25,'Lateral-direito',{ rating:76, nick:'Menino', src:WIKI_SAN + ' (RB/DM, camisa 25, empréstimo do Atlético-MG)', asOf:'2026-10-08' }),
 P('santos-arthur','Arthur','santos',6,'Meia',{ rating:76, src:WIKI_SAN + ' (CM/DM, camisa 6, chegou em 31/08/2026)', asOf:'2026-10-08' }),
 P('santos-lima','Lima','santos',45,'Meia',{ rating:75, src:WIKI_SAN + ' (AM/CM, camisa 45, empréstimo do Fluminense)', asOf:'2026-10-08' }),
 P('santos-cebolinha','Everton Cebolinha','santos',7,'Atacante',{ rating:80, nick:'Cebolinha', src:WIKI_SAN + ' (LW, camisa 7, chegou do Flamengo em 09/09/2026)', asOf:'2026-10-08' }),
 P('santos-falcao','Rodrigo Falcão','santos',67,'Goleiro',{ src:WIKI_SAN + ' (GK, camisa 67)', asOf:'2026-10-08' }),
 // ---- Fluminense (numeração oficial de 14/01/2026; posições NÃO informadas na fonte) ----
 ...[[1,'Fábio','Goleiro'],[2,'Samuel Xavier'],[3,'Jemmes'],[4,'Ignacio'],[5,'Facundo Bernal'],[6,'Renê'],[7,'Yeferson Soteldo'],[8,'Martinelli'],[9,'Everaldo'],[10,'Ganso'],[11,'Keno'],[12,'Gabriel Fuentes'],[13,'Guilherme Arana'],[14,'Germán Cano'],[15,'Matheus Reis'],[17,'Agustín Canobbio']]
   .map(([n, name, pos]) => P('fluminense-' + n, name, 'fluminense', n, pos || null, { src:NETFLU, asOf:'2026-01-14' })),
 // ---- Athletico Paranaense (numeração fixa 2026 divulgada em jan/2026; posições NÃO informadas na fonte) ----
 ...[[1,'Mycael'],[2,'Gilberto'],[3,'Léo'],[5,'Felipinho'],[7,'Mendoza'],[8,'Giuliano'],[9,'Kevin Viveros'],[10,'Bruno Zapelli'],[11,'Isaac'],[13,'Terán'],[23,'Santos']]
   .map(([n, name]) => P('athletico-pr-' + n, name, 'athletico-pr', n, null, { src:BEM_PR, asOf:'2026-01' }))
];
const SLOTS = [9, 10, 11, 7, 8];                       // camisas provisórias para completar 5 cobradores
const isGK = p => p.position === 'Goleiro';
export const verifiedCount = club => PLAYERS.filter(p => p.clubId === club.key).length;
export function squad(club) {
  const all = PLAYERS.filter(p => p.clubId === club.key), used = new Set(all.map(p => p.jerseyNumber));
  const real = all.filter(p => !isGK(p)).sort((a, b) => (b.isStar - a.isStar) || (b.rating - a.rating) || (a.jerseyNumber - b.jerseyNumber));   // goleiros não cobram; destaques primeiro
  const fill = SLOTS.filter(n => !used.has(n)).slice(0, Math.max(0, 5 - real.length)).map(n => ({ id: `${club.key}-pendente-${n}`, name: 'ATLETA', clubId: club.key, jerseyNumber: n, position: '—', isStar: false, rating: 75, celebration: 'normal', personality: ['normal'], appearance: { skinTone: n % 4 }, pending: true }));
  return [...real, ...fill];
}
// Cobrador da vez: escolhido pelo usuário (choiceId) ou rodízio automático dos 5 primeiros do elenco (destaques primeiro).
export function pickKicker(club, n, choiceId) {
  const s = squad(club), p = s.find(x => x.id === choiceId) || s[(n - 1) % Math.min(5, s.length)];
  return { id: p.id, nome: (p.nickname || p.name).toUpperCase(), num: p.jerseyNumber, star: p.isStar, rating: p.rating, pending: !!p.pending, personality: p.personality, celebration: p.celebration, appearance: p.appearance, position: p.position };
}
