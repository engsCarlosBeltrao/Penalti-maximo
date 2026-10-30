(function(){
// Seleção do motor de renderização. O motor do jogo é o Three.js/GLB (js/three/engine.js), que assume assim que carrega.
// O procedural (scene3d.js) só fica ativo com ?engine=2d ou no jogar.html (sem servidor).
const Renderer = {
  name: 'nenhum', drawScene: null, setTeams: null,
  set(impl) { this.name = impl.name; this.drawScene = impl.drawScene; this.setTeams = impl.setTeams; }
};

// 20 clubes brasileiros: cores e padrões de uniforme ESTILIZADOS (não são réplicas oficiais).
// Escudos: coloque PNGs em assets/crests/<key>.png (ex.: flamengo.png). Sem arquivo, aparece um selo neutro com a sigla.
const TEAMS = [
 ['flamengo','Flamengo','FLA','#c8102e','#111111','#ffffff','h'],['corinthians','Corinthians','COR','#ffffff','#111111','#ffffff','p'],
 ['palmeiras','Palmeiras','PAL','#006437','#ffffff','#ffffff','p'],['saopaulo','São Paulo','SAO','#ffffff','#e30613','#111111','s'],
 ['santos','Santos','SAN','#ffffff','#111111','#ffffff','p'],['gremio','Grêmio','GRE','#0d80bf','#111111','#ffffff','v'],
 ['internacional','Internacional','INT','#e5050f','#ffffff','#ffffff','p'],['atletico-mg','Atlético Mineiro','CAM','#ffffff','#111111','#ffffff','v'],
 ['cruzeiro','Cruzeiro','CRU','#0033a0','#ffffff','#ffffff','p'],['botafogo','Botafogo','BOT','#ffffff','#111111','#ffffff','v'],
 ['fluminense','Fluminense','FLU','#7b1e3a','#00913f','#ffffff','v'],['vasco','Vasco da Gama','VAS','#111111','#ffffff','#ffffff','d'],
 ['bahia','Bahia','BAH','#0057b8','#e30613','#ffffff','f'],['sport','Sport Recife','SPO','#e30613','#111111','#ffffff','h'],
 ['fortaleza','Fortaleza','FOR','#0057b8','#e30613','#ffffff','s'],['ceara','Ceará','CEA','#111111','#ffffff','#ffffff','h'],
 ['athletico-pr','Athletico Paranaense','CAP','#c8102e','#111111','#ffffff','v'],['coritiba','Coritiba','CFC','#00843d','#ffffff','#ffffff','h'],
 ['bragantino','Red Bull Bragantino','RBB','#ffffff','#e30613','#111111','d'],['vitoria','Vitória','VIT','#c8102e','#111111','#ffffff','h']
].map(([key,nome,sigla,c1,c2,c3,pat],id)=>({id,key,nome,sigla,c1,c2,c3,pat}));

// Escudos disponíveis em assets/crests/<key>.png — liste aqui a key de cada arquivo que você adicionar (evita erros 404 no console).
const CRESTS = [];

// athletico-pr: titulares (escalação-tipo do PROJETO, não a escalação oficial). Atualize aqui nome/número/posição; a aparência fica em ../appearance.js.
// n: número da camisa (null = não confirmado, aparece como "?"). pos: GK RB CB LB DM CM AM RW LW ST. star/r/cel/foot: critério do projeto.
const L_athletico_pr = {
  club: "athletico-pr", source: "Bem Paraná, jan–fev/2026 — numeração divulgada pelo clube (lista parcial: só 11 jogadores, só sobrenomes; posições inferidas pelo número)", verifiedAt: "2026-02-01", numbers: "confirmed", confidence: "baixa", posUnverified: true,
  note: "Lista parcial. Posições NÃO confirmadas (inferidas pela numeração e pelo projeto).",
  xi: [
    { n: 1, name: "Mycael", pos: "GK" },
    { n: 2, name: "Gilberto", pos: "RB" },
    { n: 13, name: "Terán", pos: "CB" },
    { n: 16, name: "Jadson", pos: "CB" },
    { n: 3, name: "Léo", pos: "LB" },
    { n: 5, name: "Felipinho", pos: "DM" },
    { n: 8, name: "Giuliano", pos: "CM", r: 79 },
    { n: 10, name: "Bruno Zapelli", nick: "Zapelli", pos: "AM", r: 80 },
    { n: 7, name: "Mendoza", pos: "RW" },
    { n: 9, name: "Kevin Viveros", nick: "Viveros", pos: "ST" },
    { n: 11, name: "Isaac", pos: "LW" }
  ]
};

// atletico-mg: titulares (escalação-tipo do PROJETO, não a escalação oficial). Atualize aqui nome/número/posição; a aparência fica em ../appearance.js.
// n: número da camisa (null = não confirmado, aparece como "?"). pos: GK RB CB LB DM CM AM RW LW ST. star/r/cel/foot: critério do projeto.
const L_atletico_mg = {
  club: "atletico-mg", source: "Wikipédia (en), \"2026 Clube Atlético Mineiro season\", tabela do elenco \"As of 13 set 2026\"", verifiedAt: "2026-09-13", numbers: "confirmed", confidence: "média",
  note: "",
  xi: [
    { n: 22, name: "Everson", pos: "GK" },
    { n: 2, name: "Natanael", pos: "RB" },
    { n: 13, name: "Lyanco", pos: "CB" },
    { n: 4, name: "Ruan Tressoldi", nick: "Tressoldi", pos: "CB" },
    { n: 6, name: "Renan Lodi", nick: "Lodi", pos: "LB" },
    { n: 21, name: "Alan Franco", pos: "DM" },
    { n: 8, name: "Maycon", pos: "CM" },
    { n: 10, name: "Gustavo Scarpa", nick: "Scarpa", pos: "AM" },
    { n: 28, name: "Tomás Cuello", nick: "Cuello", pos: "RW" },
    { n: 9, name: "Mateo Cassierra", nick: "Cassierra", pos: "ST" },
    { n: 11, name: "Bernard", pos: "LW" }
  ]
};

// bahia: titulares (escalação-tipo do PROJETO, não a escalação oficial). Atualize aqui nome/número/posição; a aparência fica em ../appearance.js.
// n: número da camisa (null = não confirmado, aparece como "?"). pos: GK RB CB LB DM CM AM RW LW ST. star/r/cel/foot: critério do projeto.
const L_bahia = {
  club: "bahia", source: "Wikipédia (en), \"2026 Esporte Clube Bahia season\", tabela do elenco \"As of 28 mar 2026\"", verifiedAt: "2026-03-28", numbers: "confirmed", confidence: "baixa",
  note: "Fonte de março/2026; transferências posteriores não verificadas.",
  xi: [
    { n: 1, name: "Ronaldo", pos: "GK" },
    { n: 2, name: "Gilberto", pos: "RB" },
    { n: 3, name: "Gabriel Xavier", nick: "Xavier", pos: "CB" },
    { n: 4, name: "Kanu", pos: "CB" },
    { n: 46, name: "Luciano Juba", nick: "Juba", pos: "LB" },
    { n: 5, name: "Nicolás Acevedo", nick: "Acevedo", pos: "DM" },
    { n: 6, name: "Jean Lucas", pos: "CM" },
    { n: 10, name: "Éverton Ribeiro", nick: "Ribeiro", pos: "AM" },
    { n: 7, name: "Ademir", pos: "RW" },
    { n: 12, name: "Willian José", pos: "ST" },
    { n: 16, name: "Erick Pulga", nick: "Pulga", pos: "LW" }
  ]
};

// botafogo: titulares (escalação-tipo do PROJETO, não a escalação oficial). Atualize aqui nome/número/posição; a aparência fica em ../appearance.js.
// n: número da camisa (null = não confirmado, aparece como "?"). pos: GK RB CB LB DM CM AM RW LW ST. star/r/cel/foot: critério do projeto.
const L_botafogo = {
  club: "botafogo", source: "Wikipédia (en), \"2026 Botafogo FR season\", tabela do elenco \"As of 13 fev 2026\"", verifiedAt: "2026-02-13", numbers: "confirmed", confidence: "baixa",
  note: "Fonte DESATUALIZADA (fev/2026): jogadores podem ter saído (ex.: Alexander Barboza aparece no Palmeiras em ago/2026).",
  xi: [
    { n: 1, name: "Raul", pos: "GK" },
    { n: 2, name: "Vitinho", pos: "RB" },
    { n: 4, name: "Mateo Ponte", nick: "Ponte", pos: "CB" },
    { n: 15, name: "Bastos", pos: "CB" },
    { n: 13, name: "Alex Telles", nick: "Telles", pos: "LB" },
    { n: 25, name: "Allan", pos: "DM" },
    { n: 8, name: "Danilo", pos: "CM" },
    { n: 10, name: "Álvaro Montoro", nick: "Montoro", pos: "AM" },
    { n: 7, name: "Artur", pos: "RW" },
    { n: 19, name: "Arthur Cabral", nick: "Cabral", pos: "ST" },
    { n: 11, name: "Matheus Martins", pos: "LW" }
  ]
};

// bragantino: titulares (escalação-tipo do PROJETO, não a escalação oficial). Atualize aqui nome/número/posição; a aparência fica em ../appearance.js.
// n: número da camisa (null = não confirmado, aparece como "?"). pos: GK RB CB LB DM CM AM RW LW ST. star/r/cel/foot: critério do projeto.
const L_bragantino = {
  club: "bragantino", source: "Wikipédia (en), \"Red Bull Bragantino\", \"Current squad as of 24 February 2026\" (espelho wiki.krisyotam.com, 2026-03)", verifiedAt: "2026-02-24", numbers: "confirmed", confidence: "baixa",
  note: "Fonte de fev/2026.",
  xi: [
    { n: 1, name: "Cleiton", pos: "GK" },
    { n: 23, name: "Agustín Sant'Anna", nick: "Sant'Anna", pos: "RB" },
    { n: 16, name: "Gustavo Marques", pos: "CB" },
    { n: 4, name: "Alix Vinicius", nick: "Alix", pos: "CB" },
    { n: 29, name: "Juninho Capixaba", nick: "Capixaba", pos: "LB" },
    { n: 5, name: "Fabinho", pos: "DM" },
    { n: 7, name: "Eric Ramires", nick: "Ramires", pos: "CM" },
    { n: 25, name: "Bruno Praxedes", nick: "Praxedes", pos: "AM" },
    { n: 8, name: "Eduardo Sasha", nick: "Sasha", pos: "RW" },
    { n: 9, name: "Isidro Pitta", nick: "Pitta", pos: "ST" },
    { n: 30, name: "Henry Mosquera", nick: "Mosquera", pos: "LW" }
  ]
};

// ceara: titulares (escalação-tipo do PROJETO, não a escalação oficial). Atualize aqui nome/número/posição; a aparência fica em ../appearance.js.
// n: número da camisa (null = não confirmado, aparece como "?"). pos: GK RB CB LB DM CM AM RW LW ST. star/r/cel/foot: critério do projeto.
const L_ceara = {
  club: "ceara", source: "Diário do Nordeste, \"Ceará x Novorizontino na Série B\" (18/09/2026): prováveis escalações", verifiedAt: "2026-09-18", numbers: "unconfirmed", confidence: "baixa",
  note: "Escalação PROVÁVEL de um jogo da Série B (posições inferidas pela ordem dos nomes). NÚMEROS NÃO ENCONTRADOS: aparecem como \"?\".",
  xi: [
    { n: null, name: "Richard", pos: "GK" },
    { n: null, name: "Bryan Borges", nick: "Bryan", pos: "RB" },
    { n: null, name: "Júlio César", pos: "CB" },
    { n: null, name: "Luizão", pos: "CB" },
    { n: null, name: "Sanchez", pos: "LB" },
    { n: null, name: "Richardson", pos: "DM" },
    { n: null, name: "João Gabriel", pos: "CM" },
    { n: null, name: "Melk", pos: "AM" },
    { n: null, name: "Matheus Araújo", pos: "AM" },
    { n: null, name: "Enzo", pos: "ST" },
    { n: null, name: "Saulo Mineiro", nick: "Saulo", pos: "ST" }
  ]
};

// corinthians: titulares (escalação-tipo do PROJETO, não a escalação oficial). Atualize aqui nome/número/posição; a aparência fica em ../appearance.js.
// n: número da camisa (null = não confirmado, aparece como "?"). pos: GK RB CB LB DM CM AM RW LW ST. star/r/cel/foot: critério do projeto.
const L_corinthians = {
  club: "corinthians", source: "Wikipédia (en), \"2026 SC Corinthians Paulista season\", tabela do elenco \"As of 21 fev 2026 (\"Squad numbers last updated\")\"", verifiedAt: "2026-02-21", numbers: "confirmed", confidence: "baixa",
  note: "Números de fev/2026; transferências do segundo semestre não verificadas.",
  xi: [
    { n: 1, name: "Hugo Souza", pos: "GK" },
    { n: 2, name: "Matheuzinho", pos: "RB" },
    { n: 3, name: "Gabriel Paulista", pos: "CB" },
    { n: 5, name: "André Ramalho", pos: "CB" },
    { n: 21, name: "Matheus Bidu", nick: "Bidu", pos: "LB" },
    { n: 14, name: "Raniele", pos: "DM" },
    { n: 7, name: "Breno Bidon", nick: "Bidon", pos: "CM" },
    { n: 8, name: "Rodrigo Garro", nick: "Garro", pos: "AM" },
    { n: 11, name: "Vitinho", pos: "RW" },
    { n: 9, name: "Yuri Alberto", pos: "ST" },
    { n: 10, name: "Memphis Depay", nick: "Memphis", pos: "LW", star: true, r: 88, cel: "confident" }
  ]
};

// coritiba: titulares (escalação-tipo do PROJETO, não a escalação oficial). Atualize aqui nome/número/posição; a aparência fica em ../appearance.js.
// n: número da camisa (null = não confirmado, aparece como "?"). pos: GK RB CB LB DM CM AM RW LW ST. star/r/cel/foot: critério do projeto.
const L_coritiba = {
  club: "coritiba", source: "Banda B, \"Em quatro meses, veja quem ganhou e quem perdeu espaço no Coritiba durante o Brasileirão\" (06/06/2026): nomes e posições citados", verifiedAt: "2026-06-06", numbers: "unconfirmed", confidence: "baixa",
  note: "XI MONTADO PELO PROJETO a partir dos nomes citados (a fonte não traz escalação nem números). NÚMEROS NÃO ENCONTRADOS: aparecem como \"?\".",
  xi: [
    { n: null, name: "Pedro Morisco", nick: "Morisco", pos: "GK" },
    { n: null, name: "Tinga", pos: "RB" },
    { n: null, name: "Maicon", pos: "CB" },
    { n: null, name: "Tiago Cóser", nick: "Cóser", pos: "CB" },
    { n: null, name: "Bruno Melo", pos: "LB" },
    { n: null, name: "Willian Oliveira", pos: "DM" },
    { n: null, name: "Vini Paulista", pos: "CM" },
    { n: null, name: "Thiago Santos", pos: "CM" },
    { n: null, name: "Pedro Rocha", pos: "RW" },
    { n: null, name: "Lavega", pos: "ST" },
    { n: null, name: "Breno Lopes", pos: "LW" }
  ]
};

// cruzeiro: titulares (escalação-tipo do PROJETO, não a escalação oficial). Atualize aqui nome/número/posição; a aparência fica em ../appearance.js.
// n: número da camisa (null = não confirmado, aparece como "?"). pos: GK RB CB LB DM CM AM RW LW ST. star/r/cel/foot: critério do projeto.
const L_cruzeiro = {
  club: "cruzeiro", source: "Wikipédia (en), \"2026 Cruzeiro Esporte Clube season\", tabela do elenco \"As of 6 ago 2026\"", verifiedAt: "2026-08-06", numbers: "confirmed", confidence: "média",
  note: "",
  xi: [
    { n: 1, name: "Cássio", pos: "GK" },
    { n: 23, name: "Fagner", pos: "RB" },
    { n: 15, name: "Fabrício Bruno", pos: "CB" },
    { n: 25, name: "Lucas Villalba", nick: "Villalba", pos: "CB" },
    { n: 27, name: "Gabriel Rojas", nick: "Rojas", pos: "LB" },
    { n: 16, name: "Lucas Silva", pos: "DM" },
    { n: 29, name: "Lucas Romero", nick: "Romero", pos: "CM" },
    { n: 10, name: "Matheus Pereira", pos: "AM" },
    { n: 77, name: "Gabriel Pec", nick: "Pec", pos: "RW" },
    { n: 19, name: "Kaio Jorge", pos: "ST" },
    { n: 17, name: "Luis Sinisterra", nick: "Sinisterra", pos: "LW" }
  ]
};

// flamengo: titulares (escalação-tipo do PROJETO, não a escalação oficial). Atualize aqui nome/número/posição; a aparência fica em ../appearance.js.
// n: número da camisa (null = não confirmado, aparece como "?"). pos: GK RB CB LB DM CM AM RW LW ST. star/r/cel/foot: critério do projeto.
const L_flamengo = {
  club: "flamengo", source: "Wikipédia (en), \"2026 CR Flamengo season\", tabela do elenco \"As of 19 set 2026\"", verifiedAt: "2026-09-19", numbers: "confirmed", confidence: "alta",
  note: "Números conferidos também em flavoz.com.br e vavel.com.br (08/10/2026).",
  xi: [
    { n: 1, name: "Agustín Rossi", nick: "Rossi", pos: "GK" },
    { n: 2, name: "Guillermo Varela", nick: "Varela", pos: "RB" },
    { n: 4, name: "Léo Pereira", pos: "CB" },
    { n: 13, name: "Danilo", pos: "CB" },
    { n: 6, name: "Ayrton Lucas", pos: "LB" },
    { n: 21, name: "Jorginho", pos: "DM" },
    { n: 11, name: "Lucas Paquetá", nick: "Paquetá", pos: "AM", star: true, r: 87, cel: "confident" },
    { n: 10, name: "Giorgian de Arrascaeta", nick: "Arrascaeta", pos: "AM", star: true, r: 90, cel: "crest" },
    { n: 7, name: "Luiz Araújo", pos: "RW" },
    { n: 27, name: "Bruno Henrique", pos: "LW" },
    { n: 9, name: "Pedro", pos: "ST", star: true, r: 86, cel: "arms" }
  ],
  reserves: [
    { n: 15, name: "Jorge Carrascal", nick: "Carrascal", pos: "AM" }
  ]
};

// fluminense: titulares (escalação-tipo do PROJETO, não a escalação oficial). Atualize aqui nome/número/posição; a aparência fica em ../appearance.js.
// n: número da camisa (null = não confirmado, aparece como "?"). pos: GK RB CB LB DM CM AM RW LW ST. star/r/cel/foot: critério do projeto.
const L_fluminense = {
  club: "fluminense", source: "Netflu 14/01/2026 — numeração oficial divulgada pelo clube (posições inferidas pelo projeto; transferências posteriores NÃO verificadas)", verifiedAt: "2026-01-14", numbers: "confirmed", confidence: "baixa", posUnverified: true,
  note: "Numeração de janeiro/2026.",
  xi: [
    { n: 1, name: "Fábio", pos: "GK" },
    { n: 2, name: "Samuel Xavier", pos: "RB" },
    { n: 4, name: "Ignacio", pos: "CB" },
    { n: 22, name: "Freytes", pos: "CB" },
    { n: 13, name: "Guilherme Arana", nick: "Arana", pos: "LB", r: 80 },
    { n: 5, name: "Facundo Bernal", nick: "Bernal", pos: "DM" },
    { n: 8, name: "Martinelli", pos: "CM" },
    { n: 10, name: "Ganso", pos: "AM", star: true, r: 84, cel: "confident" },
    { n: 11, name: "Keno", pos: "RW" },
    { n: 14, name: "Germán Cano", nick: "Cano", pos: "ST", star: true, r: 85, cel: "arms" },
    { n: 7, name: "Yeferson Soteldo", nick: "Soteldo", pos: "LW", r: 80 }
  ],
  reserves: [
    { n: 3, name: "Jemmes" },
    { n: 6, name: "Renê" },
    { n: 9, name: "Everaldo" },
    { n: 12, name: "Gabriel Fuentes" },
    { n: 15, name: "Matheus Reis" },
    { n: 16, name: "Nonato" },
    { n: 17, name: "Agustín Canobbio", nick: "Canobbio" },
    { n: 18, name: "Lelê" },
    { n: 19, name: "Lezcano" },
    { n: 21, name: "Igor Rabello" },
    { n: 23, name: "Guga" },
    { n: 24, name: "Daniel" },
    { n: 27, name: "Pitaluga" },
    { n: 28, name: "Riquelme" },
    { n: 30, name: "Santi Moreno" },
    { n: 32, name: "Lucho Acosta", nick: "Acosta", r: 80 },
    { n: 34, name: "Wesley Natã" },
    { n: 35, name: "Hércules" },
    { n: 39, name: "Keven Samuel" },
    { n: 40, name: "Davi Schuindt" },
    { n: 41, name: "Loiola" }
  ]
};

// fortaleza: titulares (escalação-tipo do PROJETO, não a escalação oficial). Atualize aqui nome/número/posição; a aparência fica em ../appearance.js.
// n: número da camisa (null = não confirmado, aparece como "?"). pos: GK RB CB LB DM CM AM RW LW ST. star/r/cel/foot: critério do projeto.
const L_fortaleza = {
  club: "fortaleza", source: "Diário do Nordeste, \"Fortaleza tem dois desfalques por suspensão para jogo contra Ponte Preta\" (20/10/2026): provável XI 5-3-2", verifiedAt: "2026-10-20", numbers: "unconfirmed", confidence: "baixa",
  note: "Escalação PROVÁVEL de um jogo da Série B (não elenco oficial). NÚMEROS DAS CAMISAS NÃO ENCONTRADOS em fonte confiável: aparecem como \"?\".",
  xi: [
    { n: null, name: "João Ricardo", pos: "GK" },
    { n: null, name: "Mailton", pos: "RB" },
    { n: null, name: "Lucas Gazal", nick: "Gazal", pos: "CB" },
    { n: null, name: "Bastos", pos: "CB" },
    { n: null, name: "Neris", pos: "CB" },
    { n: null, name: "Mucuri", pos: "LB" },
    { n: null, name: "Pierre", pos: "DM" },
    { n: null, name: "Eduardo Sasha", nick: "Sasha", pos: "CM" },
    { n: null, name: "Rodriguinho", pos: "AM" },
    { n: null, name: "Luiz Fernando", pos: "ST" },
    { n: null, name: "Cantillo", pos: "ST" }
  ]
};

// gremio: titulares (escalação-tipo do PROJETO, não a escalação oficial). Atualize aqui nome/número/posição; a aparência fica em ../appearance.js.
// n: número da camisa (null = não confirmado, aparece como "?"). pos: GK RB CB LB DM CM AM RW LW ST. star/r/cel/foot: critério do projeto.
const L_gremio = {
  club: "gremio", source: "Wikipédia (en), \"2026 Grêmio FBPA season\", tabela do elenco \"As of 7 out 2026\"", verifiedAt: "2026-10-07", numbers: "confirmed", confidence: "alta",
  note: "",
  xi: [
    { n: 1, name: "Weverton", pos: "GK" },
    { n: 14, name: "Marcos Rocha", pos: "RB" },
    { n: 4, name: "Walter Kannemann", nick: "Kannemann", pos: "CB" },
    { n: 3, name: "Wagner Leonardo", pos: "CB" },
    { n: 23, name: "Marlon", pos: "LB" },
    { n: 20, name: "Mathías Villasanti", nick: "Villasanti", pos: "DM" },
    { n: 8, name: "Erick Noriega", nick: "Noriega", pos: "CM" },
    { n: 10, name: "Filip Krovinović", nick: "Krovinović", pos: "AM" },
    { n: 7, name: "Cristian Pavón", nick: "Pavón", pos: "RW" },
    { n: 22, name: "Martin Braithwaite", nick: "Braithwaite", pos: "ST" },
    { n: 9, name: "Francis Amuzu", nick: "Amuzu", pos: "LW" }
  ]
};

// internacional: titulares (escalação-tipo do PROJETO, não a escalação oficial). Atualize aqui nome/número/posição; a aparência fica em ../appearance.js.
// n: número da camisa (null = não confirmado, aparece como "?"). pos: GK RB CB LB DM CM AM RW LW ST. star/r/cel/foot: critério do projeto.
const L_internacional = {
  club: "internacional", source: "Wikipédia (en), \"2026 Sport Club Internacional season\", tabela do elenco \"As of 25 jul 2026\"", verifiedAt: "2026-07-25", numbers: "confirmed", confidence: "média",
  note: "Elenco de julho; janela de transferências posterior não verificada.",
  xi: [
    { n: 1, name: "Sergio Rochet", nick: "Rochet", pos: "GK" },
    { n: 15, name: "Bruno Gomes", pos: "RB" },
    { n: 25, name: "Gabriel Mercado", nick: "Mercado", pos: "CB" },
    { n: 3, name: "Guillermo Maripán", nick: "Maripán", pos: "CB" },
    { n: 26, name: "Alexandro Bernabei", nick: "Bernabei", pos: "LB" },
    { n: 29, name: "Thiago Maia", pos: "DM" },
    { n: 8, name: "Bruno Henrique", pos: "CM" },
    { n: 10, name: "Alan Patrick", pos: "AM" },
    { n: 7, name: "Johan Carbonero", nick: "Carbonero", pos: "RW" },
    { n: 9, name: "Alerrandro", pos: "ST" },
    { n: 11, name: "Kayky", pos: "LW" }
  ]
};

// palmeiras: titulares (escalação-tipo do PROJETO, não a escalação oficial). Atualize aqui nome/número/posição; a aparência fica em ../appearance.js.
// n: número da camisa (null = não confirmado, aparece como "?"). pos: GK RB CB LB DM CM AM RW LW ST. star/r/cel/foot: critério do projeto.
const L_palmeiras = {
  club: "palmeiras", source: "Wikipédia (en), \"2026 SE Palmeiras season\", tabela do elenco \"As of 31 ago 2026\"", verifiedAt: "2026-08-31", numbers: "confirmed", confidence: "média",
  note: "Elenco de 31/08/2026; transferências posteriores não verificadas.",
  xi: [
    { n: 1, name: "Carlos Miguel", pos: "GK" },
    { n: 4, name: "Agustín Giay", nick: "Giay", pos: "RB" },
    { n: 15, name: "Gustavo Gómez", pos: "CB" },
    { n: 26, name: "Murilo", pos: "CB" },
    { n: 22, name: "Joaquín Piquerez", nick: "Piquerez", pos: "LB" },
    { n: 17, name: "Marlon Freitas", pos: "DM" },
    { n: 8, name: "Andreas Pereira", pos: "CM" },
    { n: 11, name: "Jhon Arias", nick: "Arias", pos: "AM" },
    { n: 7, name: "Felipe Anderson", pos: "RW" },
    { n: 9, name: "Vitor Roque", pos: "ST" },
    { n: 10, name: "Paulinho", pos: "LW" }
  ]
};

// santos: titulares (escalação-tipo do PROJETO, não a escalação oficial). Atualize aqui nome/número/posição; a aparência fica em ../appearance.js.
// n: número da camisa (null = não confirmado, aparece como "?"). pos: GK RB CB LB DM CM AM RW LW ST. star/r/cel/foot: critério do projeto.
const L_santos = {
  club: "santos", source: "Wikipédia (en), \"2026 Santos FC season\", tabela do elenco \"As of 8 out 2026\"", verifiedAt: "2026-10-08", numbers: "confirmed", confidence: "alta",
  note: "Neymar (10) e Gabigol (9) também em Itatiaia/Tribuna de Jundiaí.",
  xi: [
    { n: 77, name: "Gabriel Brazão", nick: "Brazão", pos: "GK" },
    { n: 23, name: "Rodinei", pos: "RB" },
    { n: 14, name: "Luan Peres", pos: "CB" },
    { n: 4, name: "Lucas Veríssimo", nick: "Veríssimo", pos: "CB" },
    { n: 3, name: "Vinicius Lira", pos: "LB" },
    { n: 5, name: "João Schmidt", nick: "Schmidt", pos: "DM" },
    { n: 32, name: "Benjamín Rollheiser", nick: "Rollheiser", pos: "CM" },
    { n: 10, name: "Neymar Jr.", nick: "Neymar", pos: "AM", star: true, r: 92, cel: "confident", foot: "right" },
    { n: 7, name: "Everton Cebolinha", nick: "Cebolinha", pos: "RW" },
    { n: 9, name: "Gabriel Barbosa", nick: "Gabigol", pos: "ST", star: true, r: 88, cel: "arms", foot: "left" },
    { n: 22, name: "Álvaro Barreal", nick: "Barreal", pos: "LW" }
  ]
};

// saopaulo: titulares (escalação-tipo do PROJETO, não a escalação oficial). Atualize aqui nome/número/posição; a aparência fica em ../appearance.js.
// n: número da camisa (null = não confirmado, aparece como "?"). pos: GK RB CB LB DM CM AM RW LW ST. star/r/cel/foot: critério do projeto.
const L_saopaulo = {
  club: "saopaulo", source: "Wikipédia (en), \"2026 São Paulo FC season\", tabela do elenco \"As of 14 set 2026\"", verifiedAt: "2026-09-14", numbers: "confirmed", confidence: "média",
  note: "",
  xi: [
    { n: 23, name: "Rafael", pos: "GK" },
    { n: 20, name: "Aurélio Buta", nick: "Buta", pos: "RB" },
    { n: 5, name: "Robert Arboleda", nick: "Arboleda", pos: "CB" },
    { n: 2, name: "Rafael Tolói", nick: "Tolói", pos: "CB" },
    { n: 18, name: "Wendell", pos: "LB" },
    { n: 16, name: "Damián Bobadilla", nick: "Bobadilla", pos: "DM" },
    { n: 8, name: "Marcos Antônio", pos: "CM" },
    { n: 10, name: "Luciano", pos: "AM" },
    { n: 7, name: "Lucas Moura", pos: "RW" },
    { n: 9, name: "Jonathan Calleri", nick: "Calleri", pos: "ST" },
    { n: 11, name: "Ferreira", pos: "LW" }
  ]
};

// sport: titulares (escalação-tipo do PROJETO, não a escalação oficial). Atualize aqui nome/número/posição; a aparência fica em ../appearance.js.
// n: número da camisa (null = não confirmado, aparece como "?"). pos: GK RB CB LB DM CM AM RW LW ST. star/r/cel/foot: critério do projeto.
const L_sport = {
  club: "sport", source: "Wikipédia (en), \"2026 Sport Club do Recife season\", tabela do elenco \"As of 28 mar 2026\"", verifiedAt: "2026-03-28", numbers: "confirmed", confidence: "baixa",
  note: "Fonte de março/2026; vários jogadores são emprestados.",
  xi: [
    { n: 1, name: "Halls", pos: "GK" },
    { n: 13, name: "Madson", pos: "RB" },
    { n: 5, name: "Marcelo Benevenuto", nick: "Benevenuto", pos: "CB" },
    { n: 4, name: "Zé Marcos", pos: "CB" },
    { n: 3, name: "Marcelo Ajul", nick: "Ajul", pos: "LB" },
    { n: 8, name: "Max Alves", pos: "DM" },
    { n: 7, name: "Yago Felipe", pos: "CM" },
    { n: 10, name: "Carlos de Pena", nick: "Pena", pos: "AM" },
    { n: 77, name: "Micael", pos: "RW" },
    { n: 9, name: "Pedro Perotti", nick: "Perotti", pos: "ST" },
    { n: 11, name: "Gustavo Maia", pos: "LW" }
  ]
};

// vasco: titulares (escalação-tipo do PROJETO, não a escalação oficial). Atualize aqui nome/número/posição; a aparência fica em ../appearance.js.
// n: número da camisa (null = não confirmado, aparece como "?"). pos: GK RB CB LB DM CM AM RW LW ST. star/r/cel/foot: critério do projeto.
const L_vasco = {
  club: "vasco", source: "Wikipédia (en), \"2026 CR Vasco da Gama season\", tabela do elenco \"As of 5 set 2026\"", verifiedAt: "2026-09-05", numbers: "confirmed", confidence: "média",
  note: "",
  xi: [
    { n: 1, name: "Léo Jardim", nick: "Jardim", pos: "GK" },
    { n: 2, name: "Puma Rodríguez", nick: "Puma", pos: "RB" },
    { n: 30, name: "Robert Renan", pos: "CB" },
    { n: 43, name: "Lucas Freitas", pos: "CB" },
    { n: 6, name: "Lucas Piton", nick: "Piton", pos: "LB" },
    { n: 5, name: "Santiago Sosa", nick: "Sosa", pos: "DM" },
    { n: 3, name: "Tchê Tchê", pos: "CM" },
    { n: 10, name: "Johan Rojas", nick: "Rojas", pos: "AM" },
    { n: 17, name: "Nuno Moreira", pos: "RW" },
    { n: 20, name: "Brenner", pos: "ST" },
    { n: 11, name: "Andrés Gómez", nick: "Andrés Gómez", pos: "LW" }
  ]
};

// vitoria: titulares (escalação-tipo do PROJETO, não a escalação oficial). Atualize aqui nome/número/posição; a aparência fica em ../appearance.js.
// n: número da camisa (null = não confirmado, aparece como "?"). pos: GK RB CB LB DM CM AM RW LW ST. star/r/cel/foot: critério do projeto.
const L_vitoria = {
  club: "vitoria", source: "Wikipédia (en), \"2026 Esporte Clube Vitória season\", tabela do elenco \"As of 2 abr 2026\"", verifiedAt: "2026-04-02", numbers: "confirmed", confidence: "baixa",
  note: "Fonte de abril/2026.",
  xi: [
    { n: 1, name: "Lucas Arcanjo", nick: "Arcanjo", pos: "GK" },
    { n: 2, name: "Claudinho", pos: "RB" },
    { n: 4, name: "Camutanga", pos: "CB" },
    { n: 5, name: "Riccieli", pos: "CB" },
    { n: 26, name: "Edenilson", pos: "LB" },
    { n: 8, name: "Ronald", pos: "DM" },
    { n: 44, name: "Gabriel Baralhas", nick: "Baralhas", pos: "CM" },
    { n: 10, name: "Matheuzinho", pos: "AM" },
    { n: 11, name: "Osvaldo", pos: "RW" },
    { n: 79, name: "Renato Kayzer", nick: "Kayzer", pos: "ST" },
    { n: 23, name: "Fabrí", pos: "LW" }
  ]
};

// APARÊNCIA DOS TITULARES. Os 220 titulares têm aparência OBSERVADA em fotos (rosto oficial do Transfermarkt, só de frente; data da foto em "foto").
// Fora da tabela (reservas, jogadores novos) vale uma ESTIMATIVA determinística por id (mesmo atleta = mesma aparência sempre), que não é retrato de ninguém.
// Linha da tabela REAL (chave = id do jogador sem o clube, dentro do clube): 'penteado|cor|pele|barba|bigode|costeleta|foto|extras'
//   penteado: peça Hair_<id> de tools/hair-geometry.mjs (careca, rente, degrade_medio, topete_degrade, crespo_curto, black_power, trancas_nago…)
//   cor: preto|cesc (castanho-escuro)|cast|cclaro|loiro|ruivo|grisalho|plat (as 8 cores de HAIRC);  pele: 0 (muito clara) … 5 (negra)
//   barba: nenhuma|por_fazer|cavanhaque|queixo|cheia_curta|cheia_media|densa|longa;  bigode: nenhum|bigode_fino|bigode|bigode_marcado;  costeleta: raspada|curta|ligada|coberta
//   extras (opcional, separados por ;): c2=cor (lateral/raiz), bc=cor (barba), hl=cor e ha=0..1 (mechas), tp=0..1 (pontas descoloridas, cor hl), gr=0..1 (grisalho), bd=#cor (faixa),
//   conf=pendente (sem foto: visual neutro) | duvida (foto achada em outro clube / identidade incerta); nome=nome completo / como a identidade foi confirmada.
// Para corrigir um jogador, edite a linha dele; para um jogador fora da tabela, acrescente em APPEARANCE_OVERRIDES no formato antigo ({ skinI, hairI, hair, beard, … }).
const REAL = {
  flamengo: { 'agustin-rossi': 'social_risca|cesc|1|cheia_curta|bigode|ligada|2021-10', 'guillermo-varela': 'crop_franja|plat|0|por_fazer|nenhum|curta|2026-02|c2=cclaro', 'leo-pereira': 'ondulado_medio|cast|1|cheia_media|bigode|ligada|2025-07',
    danilo: 'cacheado_degrade|preto|4|cheia_curta|bigode|ligada|2022-09', 'ayrton-lucas': 'social_risca|preto|2|por_fazer|bigode_fino|raspada|2025-07', jorginho: 'topete_degrade|cesc|1|cheia_curta|bigode|ligada|2023-04',
    'lucas-paqueta': 'ondulado_medio|preto|2|densa|bigode|ligada|2026-06', 'giorgian-de-arrascaeta': 'degrade_medio|loiro|1|cheia_curta|bigode|ligada|2022-11|c2=cast;bc=cesc', 'luiz-araujo': 'penteado_tras|preto|2|nenhuma|nenhum|raspada|2025-07',
    'bruno-henrique': 'crespo_degrade|preto|5|nenhuma|nenhum|raspada|2024-12', pedro: 'crop_franja|plat|2|nenhuma|bigode_fino|raspada|2022-11|c2=preto' },
  corinthians: { 'hugo-souza': 'cacheado_medio|preto|4|cheia_curta|bigode|ligada|2025-09', matheuzinho: 'degrade_alto|preto|2|nenhuma|bigode_marcado|raspada|2024-09', 'gabriel-paulista': 'espetado|cesc|1|por_fazer|nenhum|curta|2024-09',
    'andre-ramalho': 'cacheado_medio|preto|2|cavanhaque|bigode|curta|2024-07', 'matheus-bidu': 'degrade_medio|preto|3|cavanhaque|bigode_fino|raspada|2022-08', raniele: 'degrade_alto|preto|4|densa|bigode|ligada|2023-04',
    'breno-bidon': 'franja_media|cesc|1|nenhuma|nenhum|curta|2024-09', 'rodrigo-garro': 'topete|cast|1|por_fazer|nenhum|curta|2024-09', vitinho: 'black_power|preto|5|nenhuma|bigode_fino|coberta|2023-06',
    'yuri-alberto': 'cacheado_degrade|preto|2|densa|bigode|ligada|2025-04', 'memphis-depay': 'trancas_nago|preto|4|cheia_media|bigode|ligada|2026-05|bd=#f2f2f2' },
  palmeiras: { 'carlos-miguel': 'rente|preto|5|cavanhaque|bigode|raspada|2024-06', 'agustin-giay': 'ondulado_medio|cast|1|nenhuma|nenhum|curta|2025-05', 'gustavo-gomez': 'espetado|preto|2|cavanhaque|bigode|curta|2025-05',
    murilo: 'crespo_degrade|preto|4|cheia_curta|bigode|raspada|2026-08', 'joaquin-piquerez': 'crop_franja|preto|1|queixo|bigode|curta|2024-01', 'marlon-freitas': 'rente|preto|5|cavanhaque|bigode|raspada|2025-07',
    'andreas-pereira': 'topete_degrade|cesc|1|por_fazer|nenhum|raspada|2022-08|hl=loiro;ha=.75', 'jhon-arias': 'crespo_degrade|preto|5|nenhuma|nenhum|raspada|2024-06', 'felipe-anderson': 'cacheado_medio|preto|3|cheia_curta|bigode|ligada|2023-08',
    'vitor-roque': 'degrade_medio|preto|3|nenhuma|bigode_fino|raspada|2025-04', paulinho: 'cacheado_degrade|preto|3|cavanhaque|bigode_fino|raspada|2022-07' },
  saopaulo: { rafael: 'topete|preto|1|cheia_curta|bigode|ligada|2025-08', 'aurelio-buta': 'crespo_curto|preto|5|nenhuma|nenhum|curta|2024-09', 'robert-arboleda': 'degrade_alto|preto|5|nenhuma|nenhum|raspada|2022-11',
    'rafael-toloi': 'topete|cclaro|1|cheia_curta|bigode|ligada|2022-09', wendell: 'twists|preto|4|nenhuma|nenhum|raspada|2022-11', 'damian-bobadilla': 'ondulado_medio|cesc|1|nenhuma|nenhum|curta|2025-08',
    'marcos-antonio': 'crespo_degrade|preto|4|nenhuma|bigode_fino|raspada|2025-08', luciano: 'espetado|preto|2|cavanhaque|bigode|curta|2025-06', 'lucas-moura': 'raspado_entradas|preto|2|cheia_curta|bigode|ligada|2022-06',
    'jonathan-calleri': 'crop_franja|cesc|1|cheia_curta|bigode|ligada|2025-02', ferreira: 'franja_media|preto|2|nenhuma|nenhum|coberta|2025-09' },
  santos: { 'gabriel-brazao': 'social_risca|preto|1|nenhuma|nenhum|curta|2026-06', rodinei: 'crespo_curto|preto|4|longa|bigode|ligada|2026-07', 'luan-peres': 'topete|cesc|1|cheia_media|bigode|ligada|2023-10',
    'lucas-verissimo': 'degrade_medio|preto|3|cavanhaque|bigode|raspada|2025-11', 'vinicius-lira': 'degrade_medio|cclaro|1|nenhuma|nenhum|raspada|2025-04', 'joao-schmidt': 'raspado_entradas|cesc|1|por_fazer|nenhum|raspada|2024-01',
    'benjamin-rollheiser': 'topete|cast|1|nenhuma|nenhum|curta|2024-09', 'neymar-jr': 'crop_franja|cesc|2|cheia_curta|bigode|ligada|2023-08', 'everton-cebolinha': 'topete_degrade|cclaro|1|por_fazer|nenhum|raspada|2025-04',
    'gabriel-barbosa': 'crop_franja|plat|2|densa|bigode|ligada|2026-05|c2=preto;bc=preto', 'alvaro-barreal': 'franja_media|preto|1|nenhuma|nenhum|coberta|2025-10' },
  gremio: { weverton: 'raspado_entradas|preto|2|cheia_curta|bigode|ligada|2025-07', 'marcos-rocha': 'crespo_curto|preto|4|nenhuma|nenhum|curta|2018-12', 'walter-kannemann': 'franja_media|cast|1|nenhuma|nenhum|curta|2019-01',
    'wagner-leonardo': 'cacheado_medio|preto|2|cheia_media|bigode|ligada|2022-08', marlon: 'degrade_medio|preto|2|nenhuma|nenhum|raspada|2022-11', 'mathias-villasanti': 'ondulado_medio|cesc|1|cheia_curta|bigode|ligada|2024-06',
    'erick-noriega': 'coque_alto|preto|2|cavanhaque|bigode_fino|raspada|2025-01', 'filip-krovinovic': 'longo_ombros|cesc|1|cheia_curta|bigode|coberta|2026-01|bd=#1b1b1b', 'cristian-pavon': 'topete_degrade|cesc|1|nenhuma|nenhum|raspada|2020-03',
    'martin-braithwaite': 'careca|preto|3|cheia_curta|bigode|ligada|2020-03', 'francis-amuzu': 'crespo_curto|preto|5|nenhuma|nenhum|curta|2024-01' },
  internacional: { 'sergio-rochet': 'social_risca|cast|1|nenhuma|nenhum|curta|2022-11', 'bruno-gomes': 'rente|cesc|1|cavanhaque|bigode_fino|raspada|2022-09', 'gabriel-mercado': 'social_risca|preto|2|nenhuma|nenhum|curta|2014-12',
    'guillermo-maripan': 'espetado|preto|2|por_fazer|nenhum|curta|2024-10', 'alexandro-bernabei': 'crop_franja|preto|1|nenhuma|nenhum|raspada|2021-11', 'thiago-maia': 'raspado_entradas|cesc|1|cheia_curta|bigode|ligada|2022-11',
    'bruno-henrique': 'topete|cesc|1|cheia_media|bigode|ligada|2023-06', 'alan-patrick': 'penteado_tras|preto|2|cavanhaque|bigode|curta|2022-01', 'johan-carbonero': 'rente|preto|5|nenhuma|nenhum|raspada|2024-08',
    alerrandro: 'crespo_degrade|preto|4|cavanhaque|bigode|raspada|2025-02', kayky: 'crespo_degrade|preto|4|nenhuma|nenhum|raspada|2021-04' },
  'atletico-mg': { everson: 'raspado_entradas|preto|2|longa|bigode|ligada|2023-06', natanael: 'social_risca|cast|1|nenhuma|nenhum|curta|2022-09', lyanco: 'longo_ombros|cast|1|cheia_media|bigode|coberta|2025-08|bd=#1b1b1b',
    'ruan-tressoldi': 'cacheado_degrade|preto|3|cavanhaque|bigode|raspada|2023-09', 'renan-lodi': 'crespo_degrade|preto|4|cheia_curta|bigode|ligada|2023-12', 'alan-franco': 'social_risca|preto|2|nenhuma|nenhum|curta|2024-06',
    maycon: 'degrade_medio|preto|2|cheia_curta|bigode|ligada|2022-01', 'gustavo-scarpa': 'cacheado_medio|cast|2|cheia_curta|bigode|ligada|2022-12', 'tomas-cuello': 'penteado_tras|preto|2|nenhuma|nenhum|raspada|2024-04',
    'mateo-cassierra': 'black_power|preto|4|nenhuma|bigode_fino|coberta|2025-09', bernard: 'social_risca|cast|1|nenhuma|nenhum|curta|2018-03' },
  cruzeiro: { cassio: 'longo_ombros|cast|1|por_fazer|nenhum|coberta|2016-03|bd=#1b1b1b', fagner: 'penteado_tras|preto|1|cavanhaque|bigode|curta|2017-12', 'fabricio-bruno': 'cacheado_medio|preto|4|densa|bigode|ligada|2025-04',
    'lucas-villalba': 'topete_degrade|preto|1|por_fazer|nenhum|raspada|2021-11', 'gabriel-rojas': 'crop_franja|preto|2|nenhuma|nenhum|raspada|2024-08', 'lucas-silva': 'penteado_tras|cast|1|cheia_curta|bigode|ligada|2019-01',
    'lucas-romero': 'franja_media|preto|2|nenhuma|nenhum|curta|2021-11', 'matheus-pereira': 'crespo_degrade|plat|3|nenhuma|bigode_fino|raspada|2023-10|c2=preto', 'gabriel-pec': 'degrade_medio|cesc|1|cavanhaque|bigode_fino|raspada|2026-02',
    'kaio-jorge': 'franja_media|cesc|2|nenhuma|nenhum|curta|2023-08', 'luis-sinisterra': 'crespo_curto|preto|5|nenhuma|nenhum|curta|2023-01' },
  botafogo: { raul: 'crop_franja|loiro|0|por_fazer|nenhum|curta|2022-08|nome=Raul Jonas Steffens', vitinho: 'crespo_degrade|preto|4|cheia_curta|bigode|ligada|2021-07', 'mateo-ponte': 'franja_media|preto|2|nenhuma|nenhum|curta|2023-02',
    bastos: 'crespo_curto|preto|5|nenhuma|nenhum|curta|2021-10', 'alex-telles': 'topete|preto|1|cheia_curta|bigode|ligada|2022-08', allan: 'social_risca|preto|2|cavanhaque|bigode|curta|2015-11',
    danilo: 'dreads_degrade|preto|5|nenhuma|nenhum|raspada|2026-06', 'alvaro-montoro': 'crop_franja|cesc|1|nenhuma|nenhum|curta|2024-07', artur: 'ondulado_medio|cesc|1|cavanhaque|bigode|curta|2025-10|nome=Artur Victor Guimarães',
    'arthur-cabral': 'raspado_entradas|cesc|1|cheia_curta|bigode|ligada|2023-11', 'matheus-martins': 'crop_franja|loiro|2|nenhuma|nenhum|raspada|2022-12|c2=preto' },
  fluminense: { fabio: 'social_risca|preto|2|cheia_curta|bigode|ligada|2025-07|gr=.45', 'samuel-xavier': 'crespo_degrade|preto|4|longa|bigode|ligada|2025-07', ignacio: 'topete_degrade|cesc|1|cheia_curta|bigode|ligada|2024-07',
    freytes: 'crop_franja|preto|1|cheia_curta|bigode|ligada|2025-07', 'guilherme-arana': 'degrade_medio|preto|2|nenhuma|nenhum|raspada|2024-06', 'facundo-bernal': 'crop_franja|cesc|1|nenhuma|nenhum|curta|2026-09',
    martinelli: 'topete_degrade|cesc|1|cavanhaque|bigode|raspada|2023-05', ganso: 'espetado|preto|2|por_fazer|nenhum|curta|2025-07', keno: 'crespo_curto|preto|5|nenhuma|nenhum|curta|2024-09',
    'german-cano': 'liso_desfiado|preto|2|nenhuma|nenhum|coberta|2025-07', 'yeferson-soteldo': 'crop_franja|plat|1|por_fazer|nenhum|raspada|2025-07|c2=preto' },
  vasco: { 'leo-jardim': 'social_risca|cesc|1|por_fazer|nenhum|curta|2025-04', 'puma-rodriguez': 'penteado_tras|preto|2|nenhuma|nenhum|raspada|2026-03', 'robert-renan': 'crespo_curto|preto|4|nenhuma|nenhum|curta|2023-01',
    'lucas-freitas': 'degrade_medio|preto|2|cavanhaque|bigode_fino|raspada|2024-01', 'lucas-piton': 'topete_degrade|cclaro|1|nenhuma|nenhum|raspada|2025-01', 'santiago-sosa': 'ondulado_medio|cesc|1|por_fazer|nenhum|curta|2023-03',
    'tche-tche': 'trancas_nago|preto|5|nenhuma|nenhum|raspada|2025-05', 'johan-rojas': 'cacheado_degrade|preto|2|nenhuma|nenhum|raspada|2024-04', 'nuno-moreira': 'cacheado_medio|cesc|1|por_fazer|nenhum|coberta|2025-10',
    brenner: 'crespo_degrade|preto|4|cavanhaque|bigode_fino|raspada|2025-09', 'andres-gomez': 'crespo_curto|preto|5|nenhuma|bigode_fino|curta|2026-06' },
  bahia: { ronaldo: 'ondulado_medio|preto|2|cheia_curta|bigode|ligada|2018-12', gilberto: 'degrade_medio|preto|3|cavanhaque|bigode|raspada|2020-10|nome=Gilberto Moraes Júnior', 'gabriel-xavier': 'degrade_medio|preto|2|nenhuma|nenhum|raspada|2022-08|nome=Gabriel Lheman Xavier',
    kanu: 'crespo_curto|preto|4|cavanhaque|nenhum|curta|2026-02', 'luciano-juba': 'degrade_medio|preto|2|nenhuma|bigode_fino|raspada|2023-09', 'nicolas-acevedo': 'degrade_medio|preto|1|por_fazer|nenhum|raspada|2025-06',
    'jean-lucas': 'crespo_degrade|preto|4|nenhuma|nenhum|raspada|2022-10', 'everton-ribeiro': 'penteado_tras|cclaro|1|cheia_curta|bigode|ligada|2021-01', ademir: 'crespo_degrade|preto|4|nenhuma|nenhum|raspada|2020-12',
    'willian-jose': 'topete_degrade|preto|2|densa|bigode|ligada|2024-07|gr=.25', 'erick-pulga': 'degrade_medio|preto|2|nenhuma|nenhum|raspada|2024-02' },
  sport: { halls: 'degrade_alto|preto|3|nenhuma|nenhum|raspada|2022-08|nome=Hedhe Halls Rocha da Silva', madson: 'crespo_degrade|preto|4|nenhuma|nenhum|raspada|2022-07|nome=Madson Ferreira dos Santos', 'marcelo-benevenuto': 'crespo_curto|preto|5|nenhuma|nenhum|curta|2020-05',
    'ze-marcos': 'crop_franja|cesc|1|cavanhaque|bigode_fino|curta|2023-10', 'marcelo-ajul': 'degrade_medio|preto|2|nenhuma|nenhum|raspada|-|conf=pendente;nome=Marcelo Alixandre Ajul (sem foto pública encontrada)', 'max-alves': 'crespo_degrade|preto|4|nenhuma|nenhum|raspada|2023-03|nome=Max Alves da Silva',
    'yago-felipe': 'social_risca|preto|2|cheia_curta|bigode|ligada|2026-05', 'carlos-de-pena': 'social_risca|cesc|1|por_fazer|nenhum|curta|2021-02', micael: 'degrade_medio|preto|2|nenhuma|nenhum|raspada|-|conf=pendente;nome=Micael de Barros Viturino (sem foto pública encontrada)',
    'pedro-perotti': 'crop_franja|cesc|2|nenhuma|nenhum|raspada|2025-10', 'gustavo-maia': 'crop_franja|preto|2|nenhuma|nenhum|raspada|2025-10' },
  fortaleza: { 'joao-ricardo': 'penteado_tras|cast|1|cavanhaque|bigode|curta|2022-09', mailton: 'degrade_medio|preto|3|cavanhaque|nenhum|raspada|2021-08', 'lucas-gazal': 'rente|cast|1|cavanhaque|bigode|raspada|2022-09',
    bastos: 'crespo_curto|preto|5|nenhuma|nenhum|curta|2021-10', neris: 'social_risca|preto|1|cavanhaque|nenhum|curta|2020-01', mucuri: 'crespo_degrade|preto|4|nenhuma|bigode_fino|raspada|2024-05',
    pierre: 'degrade_medio|preto|3|cavanhaque|nenhum|raspada|2022-09', 'eduardo-sasha': 'crop_franja|cclaro|1|cheia_curta|bigode|ligada|2022-11', rodriguinho: 'crespo_degrade|loiro|4|nenhuma|nenhum|raspada|2023-04|c2=preto',
    'luiz-fernando': 'degrade_medio|preto|2|cavanhaque|nenhum|raspada|2022-09', cantillo: 'crespo_curto|preto|5|nenhuma|nenhum|curta|2025-10' },
  ceara: { richard: 'cacheado_medio|cesc|1|por_fazer|nenhum|curta|2024-02|nome=Richard Costa', 'bryan-borges': 'crop_franja|preto|1|cheia_curta|bigode|ligada|2022-01', 'julio-cesar': 'raspado_entradas|preto|3|cheia_curta|bigode|ligada|2023-04',
    luizao: 'crespo_degrade|preto|4|cavanhaque|nenhum|raspada|2022-08', sanchez: 'social_risca|cast|1|cavanhaque|bigode|curta|2022-09', richardson: 'social_risca|preto|1|cheia_curta|bigode|ligada|2024-02',
    'joao-gabriel': 'ondulado_medio|cclaro|1|por_fazer|bigode_fino|curta|2026-06', melk: 'degrade_medio|preto|2|nenhuma|nenhum|raspada|2026-06', 'matheus-araujo': 'crop_franja|preto|1|nenhuma|nenhum|raspada|2025-05',
    enzo: 'degrade_medio|preto|2|nenhuma|nenhum|raspada|-|conf=pendente;nome=identidade não confirmada (o único Enzo do Ceará no Transfermarkt é lateral)', 'saulo-mineiro': 'crespo_degrade|preto|4|cavanhaque|bigode|raspada|2023-09' },
  'athletico-pr': { mycael: 'degrade_medio|preto|2|nenhuma|nenhum|raspada|2022-08', gilberto: 'degrade_alto|preto|4|cavanhaque|bigode_fino|raspada|2023-04|nome=Gilberto Junior (camisa 2; o Gilberto de 1993 só chegou em jul/2026)', teran: 'crespo_curto|preto|5|por_fazer|nenhum|curta|2025-02',
    jadson: 'penteado_tras|preto|1|densa|bigode|ligada|2022-08', leo: 'crespo_degrade|preto|5|nenhuma|nenhum|raspada|2025-01', felipinho: 'cacheado_degrade|preto|2|nenhuma|nenhum|raspada|2024-09',
    giuliano: 'penteado_tras|cesc|1|cheia_curta|bigode|ligada|2024-01|nome=Giuliano Victor de Paula', 'bruno-zapelli': 'crop_franja|preto|1|nenhuma|nenhum|raspada|2024-06', mendoza: 'crespo_curto|preto|5|cheia_curta|bigode|ligada|2024-02',
    'kevin-viveros': 'crespo_degrade|preto|5|nenhuma|nenhum|raspada|2024-10|hl=loiro;tp=.9', isaac: 'crespo_degrade|preto|3|nenhuma|nenhum|raspada|2026-01|nome=Isaac (n. 2004, ponta-esquerda)' },
  coritiba: { 'pedro-morisco': 'social_risca|cesc|1|nenhuma|nenhum|curta|2024-01', tinga: 'raspado_entradas|preto|4|cheia_curta|bigode|ligada|2026-05', maicon: 'rente|cast|1|cavanhaque|bigode|raspada|2017-10',
    'tiago-coser': 'social_risca|cast|1|nenhuma|nenhum|curta|2024-01', 'bruno-melo': 'social_risca|preto|2|cheia_curta|bigode|ligada|2020-08', 'willian-oliveira': 'crespo_degrade|preto|4|cavanhaque|nenhum|raspada|2022-08',
    'vini-paulista': 'topete_degrade|preto|2|cheia_curta|bigode|ligada|2023-01', 'thiago-santos': 'penteado_tras|preto|3|cheia_curta|bigode|ligada|2020-03', 'pedro-rocha': 'crespo_degrade|preto|4|nenhuma|nenhum|raspada|2019-03',
    lavega: 'crop_franja|cast|1|nenhuma|nenhum|raspada|2024-07', 'breno-lopes': 'rente|preto|2|nenhuma|nenhum|raspada|2021-02' },
  bragantino: { cleiton: 'penteado_tras|cesc|1|cheia_curta|bigode|ligada|2025-10', 'agustin-sant-anna': 'social_risca|preto|2|nenhuma|nenhum|curta|2024-07', 'gustavo-marques': 'rente|preto|5|nenhuma|bigode_fino|raspada|2024-01',
    'alix-vinicius': 'cacheado_degrade|preto|4|por_fazer|nenhum|raspada|2024-07', 'juninho-capixaba': 'ondulado_medio|cclaro|1|cheia_media|bigode|ligada|2024-06', fabinho: 'crop_franja|preto|1|nenhuma|nenhum|curta|2022-08',
    'eric-ramires': 'crespo_degrade|preto|5|nenhuma|nenhum|raspada|2022-09', 'bruno-praxedes': 'social_risca|preto|2|nenhuma|nenhum|curta|2022-09', 'eduardo-sasha': 'crop_franja|cclaro|1|cheia_curta|bigode|ligada|2022-11',
    'isidro-pitta': 'social_risca|ruivo|1|cheia_media|bigode|ligada|2025-04', 'henry-mosquera': 'crespo_curto|preto|5|nenhuma|nenhum|curta|2026-02' },
  vitoria: { 'lucas-arcanjo': 'crop_franja|preto|3|cheia_media|bigode|ligada|2025-09', claudinho: 'penteado_tras|cesc|1|cavanhaque|bigode_fino|curta|2022-09|nome=Claudio Coelho Salvático', camutanga: 'degrade_medio|preto|1|nenhuma|nenhum|raspada|2023-03',
    riccieli: 'topete|cesc|1|cheia_curta|bigode|ligada|2021-10', edenilson: 'crespo_curto|preto|4|nenhuma|nenhum|curta|2026-03', ronald: 'degrade_medio|preto|2|cheia_media|bigode|ligada|2024-05|nome=Ronald dos Santos Lopes',
    'gabriel-baralhas': 'crop_franja|preto|2|cavanhaque|bigode|raspada|2025-09', matheuzinho: 'cacheado_degrade|preto|2|nenhuma|bigode_fino|raspada|2026-08', osvaldo: 'social_risca|preto|2|nenhuma|nenhum|curta|2023-04',
    'renato-kayzer': 'degrade_medio|cclaro|1|nenhuma|nenhum|raspada|2020-09', fabri: 'cacheado_medio|preto|4|cavanhaque|bigode|curta|2023-12' },
};
const SKIN_HEX = ['#f6d0a8', '#e8b88a', '#c68642', '#a0693a', '#7a4a2a', '#53341f'];   // mesmos tons de SKINS (js/athlete.js)
const HAIR_KEYS = ['preto', 'cesc', 'cast', 'cclaro', 'loiro', 'ruivo', 'grisalho', 'plat'], HAIR_HEX = ['#15110e', '#2b1d12', '#4a3020', '#7a5230', '#c9a45c', '#a6401e', '#9aa0a6', '#e8d9b0'];
// penteado novo → o mais parecido dos 7 do renderizador 2D (bald|buzz|short|curly|long|afro|bun)
const HAIR_BASE = { careca: 'bald', raspado_entradas: 'buzz', rente: 'buzz', crespo_curto: 'buzz', trancas_nago: 'buzz', black_power: 'afro', cacheado_degrade: 'curly', cacheado_medio: 'curly', twists: 'curly', longo_ombros: 'long', liso_desfiado: 'long', coque_alto: 'bun' };
const BEARD_BASE = { nenhuma: 'none', por_fazer: 'stubble', cavanhaque: 'short', queixo: 'short', cheia_curta: 'short', cheia_media: 'full', densa: 'full', longa: 'full' };
const hairBase = h => HAIR_BASE[h] || (['bald', 'buzz', 'short', 'curly', 'long', 'afro', 'bun'].includes(h) ? h : 'short');
const hexMix = (a, b, t) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v)*t).toString(16).padStart(2, '0')).join(''); };
const skinHex = t => { const i = Math.max(0, Math.min(4, Math.floor(t))); return hexMix(SKIN_HEX[i], SKIN_HEX[i + 1], Math.max(0, Math.min(1, t - i))); };   // tom contínuo entre os 6 da paleta
const colorOf = k => HAIR_HEX[Math.max(0, HAIR_KEYS.indexOf(k))];
function expand(club, slug, row) {
  const [hair, cor, pele, beard, mustache, sideburn, foto, extra = ''] = row.split('|'), X = Object.fromEntries(extra.split(';').filter(Boolean).map(kv => kv.split('='))), id = `${club}-${slug}`;
  const skinT = Math.max(0, Math.min(5, +pele + (hash('pele|' + id) % 1000/1000 - .5)*.5));   // cada jogador com o seu tom (±0,25 em volta do índice observado)
  const o = { skinI: Math.round(skinT), skinT: +skinT.toFixed(2), skinHex: skinHex(skinT), hairI: Math.max(0, HAIR_KEYS.indexOf(cor)), hairHex: colorOf(cor), hair, beard, mustache, sideburn, foto: foto === '-' ? null : foto, basis: X.conf === 'pendente' ? 'pendente' : 'foto', conf: X.conf || 'ok' };
  if (X.c2) o.hairC2 = colorOf(X.c2); if (X.bc) o.beardC = colorOf(X.bc); if (X.hl) { o.hl = colorOf(X.hl); o.hlAmt = +(X.ha || 0); } if (X.tp) o.tips = +X.tp; if (X.gr) o.grey = +X.gr; if (X.bd) o.band = X.bd; if (X.nome) o.nomeCompleto = X.nome;
  return [id, o];
}
const hash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const APPEARANCE_OVERRIDES = Object.fromEntries(Object.entries(REAL).flatMap(([club, rows]) => Object.entries(rows).map(([slug, row]) => expand(club, slug, row))));
const rng = seed => { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0)/4294967296; }; };
const pick = (r, table) => { let x = r()*table.reduce((s, [, w]) => s + w, 0); for (const [v, w] of table) { x -= w; if (x <= 0) return v; } return table[0][0]; };
const SKIN_W = [[0, .1], [1, .2], [2, .22], [3, .22], [4, .15], [5, .11]];
const HAIR_W = [['short', .4], ['buzz', .27], ['curly', .15], ['bald', .06], ['long', .03], ['afro', .07], ['bun', .02]];
const BEARD_W = [['none', .42], ['stubble', .2], ['short', .18], ['full', .13], ['mustache', .07]];
function appearanceOf(id, posCode = 'CM', overrides = APPEARANCE_OVERRIDES) {
  const r = rng(hash('ap|' + id)), skinI = pick(r, SKIN_W); let hair = pick(r, HAIR_W); if (skinI >= 4 && (hair === 'long' || hair === 'bun')) hair = pick(r, [['buzz', 1], ['short', 1], ['afro', 1]]);
  const hairI = skinI >= 4 ? (r() < .9 ? 0 : 1) : skinI >= 2 ? pick(r, [[0, .4], [1, .35], [2, .2], [3, .05]]) : pick(r, [[0, .2], [1, .25], [2, .25], [3, .15], [4, .1], [5, .05]]),
    gk = posCode === 'GK', beard = pick(r, BEARD_W), build = +(.95 + r()*.1).toFixed(3), height = +((gk ? 1.02 : .97) + r()*.06).toFixed(3);
  const ap = { skinI, hairI, hair, beard, build, height, basis: 'estimado', ...(overrides[id] || {}) };
  return { ...ap, hair2d: hairBase(ap.hair), beard2d: BEARD_BASE[ap.beard] || ap.beard };   // hair2d/beard2d: versão para o renderizador 2D
}

// ESCALAÇÕES: junta os arquivos clubs/<clube>.js (11 titulares por clube: 1 goleiro + 10 de linha) em jogadores completos.
// Para atualizar um jogador: edite o arquivo do clube. Para trocar a aparência: appearance.js. Este arquivo não precisa mudar.
const LINEUPS = [L_flamengo, L_corinthians, L_palmeiras, L_saopaulo, L_santos, L_gremio, L_internacional, L_atletico_mg, L_cruzeiro, L_botafogo, L_fluminense, L_vasco, L_bahia, L_sport, L_fortaleza, L_ceara, L_athletico_pr, L_coritiba, L_bragantino, L_vitoria];
const POS_PT = { GK: 'Goleiro', RB: 'Lateral-direito', CB: 'Zagueiro', LB: 'Lateral-esquerdo', DM: 'Volante', CM: 'Meio-campista', AM: 'Meia-atacante', RW: 'Ponta-direita', LW: 'Ponta-esquerda', ST: 'Atacante' };
const HS_LEGACY = ['short', 'long', 'bald', 'afro'], slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function makePlayer(lu, row, starter) {
  const gk = row.pos === 'GK', ap = appearanceOf(`${lu.club}-${slug(row.name)}`, row.pos || 'CM'), id = `${lu.club}-${slug(row.name)}`;
  return { id, name: row.name, nickname: row.nick, clubId: lu.club, jerseyNumber: row.n ?? null, numberStatus: row.n == null ? 'não confirmado' : 'confirmado', position: row.pos ? POS_PT[row.pos] : null, posCode: row.pos || null, posVerified: !lu.posUnverified && !!row.pos,
    starter, isStar: !!row.star, rating: row.r ?? (gk ? 80 : 78), preferredFoot: row.foot ?? null, celebration: row.cel ?? 'normal', personality: row.star ? ['star', row.cel === 'arms' ? 'celebrator' : 'confident'] : ['normal'],
    model: 'assets/models/athlete.glb', kit: { variant: 'home', keeper: gk }, animation: { rig: gk ? 'keeper' : 'field', celebration: row.cel ?? 'normal' },
    appearance: { ...ap, skinTone: Math.min(3, ap.skinI), hairStyle: HS_LEGACY.includes(ap.hair2d) ? ap.hair2d : 'short' }, source: lu.source, verifiedAt: lu.verifiedAt, confidence: lu.confidence };
}
function buildLineupPlayers() { return LINEUPS.flatMap(lu => [...lu.xi.map(r => makePlayer(lu, r, true)), ...(lu.reserves || []).map(r => makePlayer(lu, r, false))]); }
// valida as regras do projeto: 11 titulares, 1 goleiro, números sem repetição, nomes únicos. Devolve a lista de problemas (vazia = ok).
function validateLineups(lineups = LINEUPS) {
  const bad = []; for (const lu of lineups) { const xi = lu.xi, all = [...xi, ...(lu.reserves || [])], nums = all.map(r => r.n).filter(n => n != null), names = all.map(r => r.name);
    if (xi.length !== 11) bad.push(`${lu.club}: ${xi.length} titulares (esperado 11)`); if (xi.filter(r => r.pos === 'GK').length !== 1) bad.push(`${lu.club}: precisa de exatamente 1 goleiro`);
    if (new Set(nums).size !== nums.length) bad.push(`${lu.club}: número repetido`); if (new Set(names).size !== names.length) bad.push(`${lu.club}: nome repetido`); if (!lu.source || !lu.verifiedAt) bad.push(`${lu.club}: sem fonte/data`);
    if (lu.numbers === 'confirmed' && xi.some(r => r.n == null)) bad.push(`${lu.club}: numbers=confirmed mas há número nulo`); }
  return bad;
}

// ELENCOS — só entram jogadores com FONTE e DATA. Nada aqui foi inventado; o que não foi confirmado é null/pendente ("?" na camisa).
// Os dados vivem em js/lineups/clubs/<clube>.js (11 titulares por clube + reservas conhecidas) e a aparência em js/lineups/appearance.js.
// Este arquivo só monta a API usada pelo jogo: PLAYERS, squad(clube), pickKicker(...), keeperOf(clube), lineupOf(clube).
const PLAYERS = buildLineupPlayers();
const REAL_COUNT = c => PLAYERS.filter(p => p.clubId === c.key).length;
const lineupOf = club => { const lu = LINEUPS.find(l => l.club === club.key), all = PLAYERS.filter(p => p.clubId === club.key); return { meta: lu, xi: all.filter(p => p.starter), bench: all.filter(p => !p.starter), keeper: all.find(p => p.starter && p.posCode === 'GK'), problems: validateLineups(lu ? [lu] : []) }; };
const byRank = (a, b) => b.isStar - a.isStar || (a.jerseyNumber ?? 99) - (b.jerseyNumber ?? 99);
const SLOTS = [9, 10, 11, 7, 8];
function squad(club) {                                       // cobradores: estrelas primeiro, depois os demais titulares de linha, depois reservas; o goleiro fica por último
  const all = PLAYERS.filter(p => p.clubId === club.key), field = all.filter(p => p.posCode !== 'GK'), real = [...field.filter(p => p.starter).sort(byRank), ...field.filter(p => !p.starter).sort(byRank), ...all.filter(p => p.posCode === 'GK')], used = new Set(real.map(p => p.jerseyNumber));
  const fill = real.length >= 5 ? [] : SLOTS.filter(n => !used.has(n)).slice(0, 5 - real.length).map(n => ({ id: `${club.key}-pendente-${n}`, name: 'ATLETA', clubId: club.key, jerseyNumber: n, position: null, isStar: false, rating: 75, celebration: 'normal', personality: ['normal'], appearance: { skinTone: n % 4, hairStyle: ['short', 'long', 'bald', 'afro'][n % 4] }, pending: true }));
  return [...real, ...fill];
}
const CELS = ['arms', 'crest', 'confident', 'team', 'normal'];
const lookOf = (p, cel) => ({ id: p.id, nome: (p.nickname || p.name).toUpperCase(), num: p.jerseyNumber, star: p.isStar, rating: p.rating, pending: !!p.pending, noNum: p.jerseyNumber == null, cel, skin: p.appearance.skinTone, hair: p.appearance.hair || p.appearance.hairStyle, ap: p.appearance.skinI !== undefined ? p.appearance : null });
function pickKicker(club, n, choiceId) {
  const s = squad(club), p = s.find(x => x.id === choiceId) || s[(n - 1) % Math.min(5, s.length)], cel = p.celebration !== 'normal' ? p.celebration : CELS[(n + (p.jerseyNumber || 0)) % 4];
  return lookOf(p, cel);
}
function keeperOf(club) {                                     // goleiro titular do clube (aparência e nome próprios); sem dados → null e o jogo usa o goleiro genérico
  const g = PLAYERS.find(p => p.clubId === club.key && p.starter && p.posCode === 'GK'); return g ? lookOf(g, 'normal') : null;
}

// Publicidade das placas. EDITE A LISTA ADS: cada anúncio = um objeto. Imagens (opcionais) em assets/ads/. Sem imagem → texto.
// Para usar o logotipo oficial da Campo Real: salve o arquivo em assets/ads/campo-real.png e troque image:'' por image:'assets/ads/campo-real.png'.
const ADS = [
 { id:'campo-real', sponsor:'Faculdade Campo Real', text:'Conhecimento que transforma', image:'', backgroundColor:'#123a6b', textColor:'#ffffff', duration:8, priority:100, boardGroup:'main', enabled:true },
 { id:'exemplo-1', sponsor:'Patrocinador Exemplo', text:'Seu anúncio aqui', image:'', backgroundColor:'#7a0f1f', textColor:'#ffffff', duration:5, priority:10, boardGroup:'main', enabled:true },
 { id:'exemplo-2', sponsor:'Marca Exemplo', text:'Futebol é paixão', image:'', backgroundColor:'#0b4a2a', textColor:'#ffffff', duration:5, priority:10, boardGroup:'main', enabled:true }
];                                                        // priority ≥ 100 = destaque (aparece 2x por ciclo)
const imgs = {};
function img(ad) {                                         // carrega uma vez; se falhar, usa texto (fallback)
  if (!ad.image || typeof Image === 'undefined') return null;
  if (!imgs[ad.id]) { const i = new Image(); i.onerror = () => { i.failed = true; console.warn('Anúncio sem imagem:', ad.image); }; i.src = ad.image; imgs[ad.id] = i; }
  const i = imgs[ad.id]; return i.complete && i.naturalWidth && !i.failed ? i : null;
}
function seq(group) {
  const L = ADS.filter(a => a.enabled && a.boardGroup === group).sort((a, b) => b.priority - a.priority), out = [];
  L.forEach((a, i) => { out.push(a); if (a.priority >= 100) out.push(null); }); // marcador para repetir destaque no meio
  const hi = L.filter(a => a.priority >= 100), res = []; out.forEach(a => a ? res.push(a) : null); hi.forEach(a => res.splice(Math.ceil(res.length/2), 0, a)); return res;
}
const Ads = {
  current(group, t, k) {                                  // anúncio ativo da placa k + opacidade (fade nas trocas)
    const L = seq(group); if (!L.length) return null; const tot = L.reduce((s, a) => s + a.duration, 0); let x = (t + k*L[0].duration) % tot, acc = 0;
    for (const ad of L) { if (x < acc + ad.duration) return { ad, alpha: Math.max(0, Math.min(1, (x-acc)/.5, (acc+ad.duration-x)/.5)), image: img(ad) }; acc += ad.duration; }
    return null;
  }
};

// Playlist do menu. Coloque arquivos AUTORIZADOS em assets/music/ e registre aqui. Lista vazia = jogo segue normal, sem música.
const PLAYLIST = [
  // { id:'track-01', title:'Nome da música', artist:'Artista', src:'assets/music/track-01.mp3', enabled:true }
];
// As músicas do YouTube agora são configuradas DENTRO do jogo (menu → MÚSICAS E TORCIDAS), sem editar este arquivo.

// Reprodutor da playlist: play/pause, anterior/próxima, volume, aleatório, repetir, tratamento de erros, persistência.
const KEY = 'pm_music';
const Music = {
  tracks: PLAYLIST.filter(t => t.enabled !== false), i: 0, vol: .5, shuffle: false, repeat: false, playing: false, msg: '', duck: false, fails: 0, onChange: null, a: null,
  init() { try { Object.assign(this, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch {} if (!this.tracks.length) this.msg = 'Nenhuma faixa cadastrada. Adicione arquivos em assets/music/ e registre em js/musicPlaylist.js.'; },
  save() { try { localStorage.setItem(KEY, JSON.stringify({ vol: this.vol, shuffle: this.shuffle, repeat: this.repeat })); } catch {} },
  emit() { this.onChange?.(); },
  get cur() { return this.tracks[this.i]; },
  _audio() {
    if (this.a || typeof Audio === 'undefined') return this.a;
    this.a = new Audio(); this.a.onended = () => this.next(true);
    this.a.onerror = () => { this.msg = `Arquivo não encontrado: ${this.cur?.src}`; this.playing = false; if (++this.fails < this.tracks.length) this.next(true); this.emit(); };
    return this.a;
  },
  play() {
    if (!this.tracks.length) return this.emit(); const a = this._audio(); if (!a) return;
    if (!a.src || a.dataset.i !== String(this.i)) { a.src = this.cur.src; a.dataset.i = this.i; }
    this.setVol(this.vol, true); a.play().then(() => { this.playing = true; this.fails = 0; this.msg = ''; this.emit(); }).catch(e => { this.playing = false; this.msg = e.name === 'NotAllowedError' ? 'O navegador bloqueou o áudio: clique em ▶.' : 'Não foi possível tocar esta faixa.'; this.emit(); });
  },
  pause() { this.a?.pause(); this.playing = false; this.emit(); },
  toggle() { this.playing ? this.pause() : this.play(); },
  next(auto) { if (!this.tracks.length) return; if (auto && this.repeat) { this.a.currentTime = 0; return this.play(); } this.i = this.shuffle ? Math.floor(Math.random()*this.tracks.length) : (this.i+1) % this.tracks.length; this.play(); },
  prev() { if (!this.tracks.length) return; this.i = (this.i-1+this.tracks.length) % this.tracks.length; this.play(); },
  setVol(v, quiet) { this.vol = v; if (this.a) this.a.volume = taper(v)*(this.duck ? .25 : 1); if (!quiet) { this.save(); this.emit(); } },
  setMode(m) { this.duck = m === 'game'; this.setVol(this.vol, true); },     // na partida: volume reduzido
  flag(k) { this[k] = !this[k]; this.save(); this.emit(); }
};

// Receitas sintetizadas (originais). Skills game-audio/audio-design: variação de pitch por disparo, torcida em varreduras de ruído.
// Arquivos próprios: coloque em assets/sfx/ e liste em SFX_FILES (ex.: { gol: 'assets/sfx/gol.mp3' }).
const SFX_FILES = {};
const VAR = { pitch: 1 };
const taper = v => v <= 0 ? 0 : Math.pow(10, (-40*(1 - v))/20);        // slider 0..1 → ganho em dB (percepção logarítmica)
const rd = (a, b) => a + Math.random()*(b - a);
const tone = (c, o, t, type, f0, f1, d, g) => { const os = c.createOscillator(), gn = c.createGain(), p = VAR.pitch; os.type = type; os.frequency.setValueAtTime(f0*p, t); os.frequency.exponentialRampToValueAtTime(Math.max(1, f1*p), t + d); gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(.001, t + d); os.connect(gn).connect(o); os.start(t); os.stop(t + d + .02); };
const nbuf = (c, d) => { const n = c.sampleRate*d | 0, buf = c.createBuffer(1, n, c.sampleRate), a = buf.getChannelData(0); for (let i = 0; i < n; i++) a[i] = Math.random()*2 - 1; return buf; };
const noise = (c, o, t, d, g, f, q = 1) => { const s = c.createBufferSource(), fl = c.createBiquadFilter(), gn = c.createGain(); s.buffer = nbuf(c, d); fl.type = 'bandpass'; fl.frequency.value = f*VAR.pitch; fl.Q.value = q; gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(.001, t + d); s.connect(fl).connect(gn).connect(o); s.start(t); };
const sweep = (c, o, t, d, g, f0, f1, att, q = .6) => { const s = c.createBufferSource(), fl = c.createBiquadFilter(), gn = c.createGain(); s.buffer = nbuf(c, d); fl.type = 'bandpass'; fl.Q.value = q; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t + d); gn.gain.setValueAtTime(.001, t); gn.gain.linearRampToValueAtTime(g, t + att); gn.gain.exponentialRampToValueAtTime(.001, t + d); s.connect(fl).connect(gn).connect(o); s.start(t); };
const notes = (c, o, t, fs, step, d, g, type = 'triangle') => fs.forEach((f, i) => tone(c, o, t + i*step, type, f, f, d, g));
const RECIPES = {
  chute: (c, o, t) => { tone(c, o, t, 'sine', 170, 55, .12, 1); noise(c, o, t, .05, .6, 1800); noise(c, o, t, .03, .4, 400); },   // contato do pé
  trave: (c, o, t) => { tone(c, o, t, 'square', 1900, 1750, .4, .25); tone(c, o, t, 'sine', 2600, 2500, .3, .2); noise(c, o, t, .04, .5, 3000); },
  travessao: (c, o, t) => { tone(c, o, t, 'square', 1150, 1080, .5, .25); tone(c, o, t, 'sine', 1700, 1600, .35, .2); noise(c, o, t, .04, .5, 2200); },
  rede: (c, o, t) => { noise(c, o, t, .45, .6, 900, .6); tone(c, o, t, 'sine', 120, 70, .25, .5); },
  gol: (c, o, t) => notes(c, o, t + .05, [523, 659, 784, 1047], .09, .35, .3),
  defesa: (c, o, t) => { noise(c, o, t, .09, .9, 1300, 1.5); tone(c, o, t, 'sine', 230, 120, .15, .6); },
  fora: (c, o, t) => tone(c, o, t, 'triangle', 320, 110, .35, .3),
  decisiva: (c, o, t) => { tone(c, o, t, 'sine', 75, 50, .18, .9); tone(c, o, t + .26, 'sine', 75, 50, .18, .9); },
  vitoria: (c, o, t) => notes(c, o, t, [523, 523, 523, 698, 659, 784], .16, .35, .3, 'square'),
  click: (c, o, t) => tone(c, o, t, 'square', 900, 700, .05, .15),
  // torcida (canal próprio): ruído filtrado em várias faixas = muitas vozes; durações/aberturas aleatórias evitam repetição mecânica
  expect: (c, o, t) => { const d = rd(.9, 1.3); sweep(c, o, t, d, .9, 350, rd(900, 1300), d*.8); sweep(c, o, t + .05, d, .5, 700, 1700, d*.85, .8); },       // "uuuuh" de expectativa antes do chute
  roar: (c, o, t) => { const d = rd(1.4, 2); sweep(c, o, t, d, 1, 500, rd(800, 1100), .12); sweep(c, o, t + .04, d*.85, .6, 1200, 1700, .15, .8); sweep(c, o, t, d, .5, 280, 340, .1, .5); },   // explosão do gol / defesa
  roarBig: (c, o, t) => { sweep(c, o, t, 3.2, 1, 500, 900, .2); sweep(c, o, t + .1, 3, .8, 1200, 1800, .25, .8); sweep(c, o, t, 3.2, .6, 260, 360, .2, .5); notes(c, o, t + .1, [392, 392, 523], .3, .5, .12, 'sine'); },   // fim da disputa
  groan: (c, o, t) => sweep(c, o, t, rd(.8, 1.2), .6, 480, 220, .1, .5)                                        // frustração
};

// Barramento de eventos da partida. Qualquer módulo (ex.: Arduino) pode assinar sem alterar a lógica.
const h = {};
const Events = {
  on(t, f) { (h[t] ??= []).push(f); },            // on('gol', fn) ou on('*', fn)
  emit(t, d = {}) {
    const e = { tipo: t, hora: Date.now(), ...d };
    [...(h['*'] || []), ...(h[t] || [])].forEach(f => { try { f(e); } catch (x) { console.error(x); } });
  }
};
// Eventos: partida_iniciada, gol, defesa, fora, trave, placar_alterado, cobranca_mudou, partida_encerrada, vitoria, derrota, partida_reiniciada

// Estado único e documentado da partida. Fonte de verdade para HUD e para integração externa.
const GS = {
  estado: 'MENU',          // MENU | SELECAO_EQUIPE | AGUARDANDO_COBRANCA | MIRANDO | CHUTANDO | RESOLVENDO_COBRANCA | DEFESA_DO_GOLEIRO | RESULTADO | CAMPEONATO_FINALIZADO
  equipes: [null, null],   // [{id,nome,sigla}] índice 0 = jogador
  placar: [0, 0],
  cobranca: 1,             // número da rodada atual (1..5, depois morte súbita)
  cobrancasRealizadas: 0,  // total de chutes já resolvidos
  cobrador: 0,             // 0 = jogador, 1 = adversário
  ultimaCobranca: null,    // {equipe, resultado:'gol'|'defesa'|'fora'|'trave', gx, gy}
  vencedor: null           // 0, 1 ou null
};
// Texto pronto para LCD 16x2
function getLcd() {
  const [a, b] = GS.equipes.map(t => (t?.sigla || '---'));
  const l1 = `${a} ${GS.placar[0]} x ${GS.placar[1]} ${b}`.padEnd(16).slice(0, 16);
  const l2 = `PENALTIS ${Math.min(GS.cobranca, 5)}/5`.padEnd(16).slice(0, 16);
  return [l1, l2];
}

// Mira estilo "FIFA": a linha oscila SEMPRE na horizontal; ao segurar o botão, um marcador de altura sobe ao mesmo tempo.
// Clique rápido = chute rasteiro na posição capturada; segurar = mais alto. Coordenadas do gol: gx 0..1 (esq→dir), gy 0..1 (chão→travessão).
const AIM_LIM = { xmin: -0.08, xmax: 1.08, ymin: 0.05, ymax: 1.1 };
const AIM_BASE = 0.14;                       // altura de um clique rápido
class Aim {
  constructor() { this.reset(); }
  reset() { this.x = 0.5; this.y = AIM_BASE; this.dir = 1; this.ativa = false; this.hold = false; }
  run() { this.ativa = true; }                      // começa a oscilar (vez do jogador)
  start() { this.ativa = true; this.hold = true; this.y = AIM_BASE; }   // botão pressionado: sobe o marcador sem mexer em x
  update(dt, hs, vs) {                              // dt em segundos → independe do FPS
    if (!this.ativa) return;
    this.x += this.dir * hs * dt;
    if (this.x >= AIM_LIM.xmax) { this.x = AIM_LIM.xmax; this.dir = -1; }
    if (this.x <= AIM_LIM.xmin) { this.x = AIM_LIM.xmin; this.dir = 1; }
    if (this.hold) this.y = Math.min(AIM_LIM.ymax, this.y + vs * dt);
  }
  release() { this.ativa = false; this.hold = false; return { gx: this.x, gy: this.y }; }   // congela e devolve o ponto final
}

// Campeonato: 4 grupos de 4 (todos contra todos, 3 rodadas), top-2 → quartas, semi, final. Cada jogo é uma disputa de pênaltis.
const rnd=()=>Math.random()<.72;
function simulate(){let a=0,b=0;for(let i=0;i<5;i++){a+=rnd();b+=rnd();}while(a===b){a+=rnd();b+=rnd();}return[a,b];}
const FIX=[[[0,1],[2,3]],[[0,2],[1,3]],[[0,3],[1,2]]];
class Cup {
  constructor(me){
    this.me=me; const ids=[me,...TEAMS.map(t=>t.id).filter(i=>i!==me).sort(()=>Math.random()-.5).slice(0,15)].sort(()=>Math.random()-.5);  // 16 dos 20 clubes
    this.groups=[0,1,2,3].map(g=>ids.slice(g*4,g*4+4));
    this.tab={}; ids.forEach(i=>this.tab[i]={id:i,pts:0,w:0,l:0,gf:0,ga:0});
    this.round=0; this.stage='grupos'; this.ko=[]; this.hist=[]; this.champion=null; this.alive=true;
  }
  name(i){return TEAMS[i].nome;}
  stageName(){ if(this.stage==='grupos')return`Grupos – rodada ${this.round+1}/3`; return this.ko.length===4?'Quartas de final':this.ko.length===2?'Semifinal':'Final'; }
  pairs(){ return this.stage==='grupos'?this.groups.flatMap(g=>FIX[this.round].map(([i,j])=>[g[i],g[j]])):this.ko; }
  nextForMe(){ const p=this.pairs().find(p=>p.includes(this.me)); return p?(p[0]===this.me?p:[p[1],p[0]]):null; }
  rank(g){ return [...g].sort((a,b)=>{const A=this.tab[a],B=this.tab[b];return B.pts-A.pts||(B.gf-B.ga)-(A.gf-A.ga)||B.gf-A.gf||Math.random()-.5;}); }
  _apply(a,b,ga,gb){
    this.hist.push(`${this.stageName()}: ${this.name(a)} ${ga} x ${gb} ${this.name(b)}`);
    if(this.stage==='grupos'){const A=this.tab[a],B=this.tab[b];A.gf+=ga;A.ga+=gb;B.gf+=gb;B.ga+=ga;
      if(ga>gb){A.pts+=3;A.w++;B.l++;}else{B.pts+=3;B.w++;A.l++;}}
    return ga>gb?a:b;
  }
  // Registra o resultado do jogador, simula o resto da rodada e avança o torneio.
  playerResult(ga,gb){
    const [me,op]=this.nextForMe(); const winners=[];
    for(const p of this.pairs()){
      if(p.includes(me)){const w=this._apply(me,op,ga,gb);winners.push(w);}
      else{const [x,y]=simulate();winners.push(this._apply(p[0],p[1],x,y));}
    }
    this._advance(winners,ga>gb);
  }
  _advance(winners,meWon){
    if(this.stage==='grupos'){
      this.round++; if(this.round<3)return;
      const q=this.groups.map(g=>this.rank(g)); this.stage='ko';
      this.ko=[[q[0][0],q[1][1]],[q[1][0],q[0][1]],[q[2][0],q[3][1]],[q[3][0],q[2][1]]];
      if(!this.ko.flat().includes(this.me))this.alive=false;
    } else {
      if(!meWon&&this.alive)this.alive=false;
      if(winners.length===1){this.champion=winners[0];return;}
      this.ko=winners.reduce((r,w,i)=>(i%2?r[r.length-1].push(w):r.push([w]),r),[]);
    }
    if(!this.alive)this.finish();
  }
  finish(){ // jogador eliminado: simula o resto até o campeão
    while(this.champion===null){
      const w=this.ko.map(p=>{const[x,y]=simulate();return this._apply(p[0],p[1],x,y);});
      if(w.length===1)this.champion=w[0]; else this.ko=w.reduce((r,x,i)=>(i%2?r[r.length-1].push(x):r.push([x]),r),[]);
    }
  }
}


// Módulo RESERVADO para a futura integração serial (NÃO implementada; o jogo não depende dele).
const Arduino = {
  conectado: false,
  _handlers: {},
  // O jogo registra aqui o que cada comando externo pode fazer (sempre passando pelas regras normais).
  registrarComandos(h) { this._handlers = h; },       // {iniciar, pausar, reiniciar}
  comando(nome) { this._handlers[nome]?.(); },        // futuro: chamar a partir do serial
  // Futuro: aqui você abre a porta serial e envia getLcd()/eventos.
  iniciar() {
    Events.on('*', e => { /* ex.: this.enviar(e.tipo, GS, getLcd()) */ });
  },
  enviar(/* tipo, estado, lcd */) { /* TODO: escrita serial */ }
};

const {parseYouTube,watchUrl}=(function(){
// Validação de links do YouTube: aceita só domínios do YouTube e extrai o ID de 11 caracteres (nunca usa a URL inteira como ID).
const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be', 'www.youtu.be']);
const ID = /^[A-Za-z0-9_-]{11}$/;
function parseTime(s) {                                  // 90 | 90s | 1m30s | 1h2m3s
  if (!s) return 0; if (/^\d+$/.test(s)) return +s;
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(s); if (!m || !(m[1] || m[2] || m[3])) return 0; return (+m[1] || 0)*3600 + (+m[2] || 0)*60 + (+m[3] || 0);
}
const watchUrl = id => `https://www.youtube.com/watch?v=${id}`;
function parseYouTube(input) {
  const raw = String(input ?? '').trim(); if (!raw) return { ok: false, error: 'Cole um link do YouTube.' };
  if (ID.test(raw)) return { ok: true, id: raw, start: 0, url: watchUrl(raw) };      // ID puro (11 caracteres)
  let u; try { u = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw); } catch { return { ok: false, error: 'Link inválido.' }; }
  if (!/^https?:$/.test(u.protocol) || !HOSTS.has(u.hostname.toLowerCase())) return { ok: false, error: 'Só são aceitos links do YouTube (youtube.com, youtu.be).' };
  const h = u.hostname.toLowerCase(), parts = u.pathname.split('/').filter(Boolean); let id = null;
  if (h.endsWith('youtu.be')) id = parts[0]; else if (parts[0] === 'watch') id = u.searchParams.get('v'); else if (['embed', 'shorts', 'live', 'v'].includes(parts[0])) id = parts[1];
  if (!id || !ID.test(id)) return { ok: false, error: !id && u.searchParams.get('list') ? 'Links apenas de playlist não são suportados: cole o link de um vídeo.' : 'Não encontrei um ID de vídeo válido neste link.' };
  return { ok: true, id, start: parseTime(u.searchParams.get('t') || u.searchParams.get('start')), url: watchUrl(id) };
}
return {parseYouTube,watchUrl};})();
const {Store,uid,sanitize,defaults,cleanEntry}=(function(){
// Configurações de áudio/músicas persistentes (localStorage) com validação: dados antigos ou corrompidos nunca travam o jogo.
const KEY = 'pm_audio_v1', ID = /^[A-Za-z0-9_-]{11}$/;
const MODES = ['team', 'exclusive', 'default', 'off'], STARTS = ['apresentacao', 'preparacao', 'cobranca', 'gol'], REPS = ['off', 'one', 'all'];
const uid = () => 'm' + Math.random().toString(36).slice(2, 9);
const defaults = () => ({ v: 1, menu: { tracks: [], shuffle: false, repeat: 'all' }, chants: {}, champion: { mode: 'team', exclusive: null, defaultSong: null }, play: { chantStart: 'preparacao', duckOnKick: true, keepMenuInMatch: false, master: 80 } });
const clamp = (n, a, b, d) => Number.isFinite(+n) ? Math.min(b, Math.max(a, +n)) : d;
function cleanEntry(e) {                          // devolve entrada válida ou null
  if (!e || typeof e !== 'object' || typeof e.vid !== 'string' || !ID.test(e.vid)) return null;
  return { id: typeof e.id === 'string' && e.id ? e.id.slice(0, 24) : uid(), name: String(e.name ?? '').slice(0, 60) || 'Sem nome', vid: e.vid, start: clamp(e.start, 0, 86400, 0), vol: clamp(e.vol, 0, 100, 80), enabled: e.enabled !== false, cat: String(e.cat ?? 'menu').slice(0, 20) };
}
function sanitize(raw) {
  const d = defaults(); let dropped = 0; if (!raw || typeof raw !== 'object') return { data: d, dropped: 0 };
  if (Array.isArray(raw.menu?.tracks)) raw.menu.tracks.forEach(t => { const c = cleanEntry(t); c ? d.menu.tracks.push(c) : dropped++; });
  if (typeof raw.menu?.shuffle === 'boolean') d.menu.shuffle = raw.menu.shuffle; if (REPS.includes(raw.menu?.repeat)) d.menu.repeat = raw.menu.repeat;
  if (raw.chants && typeof raw.chants === 'object') Object.entries(raw.chants).forEach(([k, v]) => { const c = cleanEntry(v); c && /^[a-z0-9-]{1,30}$/.test(k) ? d.chants[k] = c : dropped++; });
  const ch = raw.champion || {}; if (MODES.includes(ch.mode)) d.champion.mode = ch.mode; d.champion.exclusive = cleanEntry(ch.exclusive); d.champion.defaultSong = cleanEntry(ch.defaultSong);
  const p = raw.play || {}; if (STARTS.includes(p.chantStart)) d.play.chantStart = p.chantStart; ['duckOnKick', 'keepMenuInMatch'].forEach(k => { if (typeof p[k] === 'boolean') d.play[k] = p[k]; }); d.play.master = clamp(p.master, 0, 100, 80);
  return { data: d, dropped };
}
const Store = {
  data: defaults(), warning: '',
  load() {
    let raw = null; try { const s = localStorage.getItem(KEY); raw = s ? JSON.parse(s) : null; } catch { this.warning = 'Configurações salvas estavam corrompidas e foram ignoradas.'; }
    const r = sanitize(raw); this.data = r.data; if (r.dropped) this.warning = `${r.dropped} item(ns) inválido(s) foram descartados.`; return this.data;
  },
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); return true; } catch { this.warning = 'Não foi possível salvar (armazenamento bloqueado).'; return false; } },
  reset() { this.data = defaults(); this.save(); },                              // restaurar padrão
  clear() { this.data = defaults(); try { localStorage.removeItem(KEY); } catch {} }   // limpar tudo
};
return {Store,uid,sanitize,defaults,cleanEntry};})();
const {AM}=(function(){
// GERENCIADOR CENTRAL de músicas/cantos: um ÚNICO player oficial do YouTube (IFrame API), reutilizado, com prioridades:
//   teste(200) > campeão(100) > canto da equipe(50) > playlist do menu(10). Ouve os eventos reais da partida (events.js / gameState.js).
const PRI = { menu: 10, chant: 50, champion: 100, test: 200 };
const ERR = { 2: 'ID de vídeo inválido.', 5: 'Erro do player HTML5.', 100: 'Vídeo não encontrado, removido ou privado.', 101: 'O dono do vídeo não permite reprodução incorporada.', 150: 'O dono do vídeo não permite reprodução incorporada.', 153: 'Falha de configuração do player (abra pelo Live Server, não por file://).' };
const AM = {
  cur: null, playing: false, status: {}, msg: '', onChange: null, gestured: false, duckF: 1, menuI: 0, fails: 0, inited: false, player: null, _p: null, _t: null,
  emit() { try { this.onChange?.(); } catch {} },
  box(v) { const b = typeof document !== 'undefined' && document.getElementById('ytbox'); if (b) b.hidden = !v; },
  // ---- player único ----
  makePlayer(events) {                                              // padrão: YouTube IFrame API; os testes injetam um player falso
    return new Promise((res, rej) => {
      const go = () => { try { const pl = new window.YT.Player('ytplayer', { width: 200, height: 200, playerVars: { controls: 1, rel: 0, playsinline: 1, modestbranding: 1 }, events: { ...events, onReady: () => res(pl) } }); } catch (e) { rej(e); } };
      if (window.YT?.Player) return go();
      if (location.protocol === 'file:') return rej(new Error('file'));
      const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.onerror = () => rej(new Error('rede')); window.onYouTubeIframeAPIReady = go; document.head.appendChild(s); setTimeout(() => rej(new Error('tempo')), 9000);
    });
  },
  ensure() {
    return this.player ? Promise.resolve(this.player) : this._p ??= this.makePlayer({
      onStateChange: e => this.onState(e.data), onError: e => this.onError(e.data), onAutoplayBlocked: () => { this.msg = 'O navegador bloqueou o início automático: toque em ▶ no player.'; this.emit(); }
    }).then(p => (this.player = p)).catch(e => { this._p = null; this.msg = e.message === 'file' ? 'O YouTube não funciona abrindo o arquivo direto (file://). Use o Live Server.' : 'Não foi possível carregar o player do YouTube (sem internet ou bloqueado).'; if (this.cur) this.status[this.cur.entry.id] = { ok: false, msg: this.msg }; this.cur = null; this.playing = false; this.box(false); this.emit(); throw e; });
  },
  onState(s) {                                                      // 1 tocando · 2 pausado · 0 terminou · 3 carregando
    if (s === 1) { this.playing = true; this.fails = 0; this.msg = ''; if (this.cur) this.status[this.cur.entry.id] = { ok: true }; }
    else if (s === 2) this.playing = false;
    else if (s === 0) { this.playing = false; if (this.cur?.kind === 'menu') this.menuNext(true); else if (this.cur) { this.cur = null; this.box(false); } }
    this.emit();
  },
  onError(code) {
    const m = ERR[code] || 'Erro ao reproduzir este vídeo.', c = this.cur; this.msg = m; this.playing = false; if (c) this.status[c.entry.id] = { ok: false, msg: m };
    if (c?.kind === 'menu' && ++this.fails < Math.max(1, this.menuList().length)) this.menuNext(true); else { this.cur = null; this.box(false); }
    this.emit();
  },
  vol() { return Math.round((this.cur?.entry.vol ?? 0) * Store.data.play.master/100 * this.duckF); },
  applyVol() { try { this.player?.setVolume(this.vol()); } catch {} },
  // ---- reprodução com prioridade ----
  async play(entry, kind) {
    if (!entry) return false; if (this.cur && this.playing && PRI[this.cur.kind] > PRI[kind]) return false;     // algo mais importante já toca
    this.cur = { entry, kind }; this.msg = ''; this.emit();
    try { const p = await this.ensure(); if (!this.cur || this.cur.entry !== entry) return false;               // trocou enquanto carregava
      this.box(true); p.loadVideoById({ videoId: entry.vid, startSeconds: entry.start || 0 }); this.applyVol(); return true; } catch { return false; }
  },
  stop(kinds) { if (!this.cur || (kinds && !kinds.includes(this.cur.kind))) return; try { this.player?.stopVideo(); } catch {} this.cur = null; this.playing = false; this.box(false); this.emit(); },
  test(entry) { this.cur?.kind === 'test' && this.cur.entry === entry ? this.stop() : this.play(entry, 'test'); },
  togglePause() { if (!this.player || !this.cur) return; try { this.playing ? this.player.pauseVideo() : this.player.playVideo(); } catch {} },
  // ---- playlist do menu ----
  menuList() { return Store.data.menu.tracks.filter(t => t.enabled); },
  startMenu() { if (!this.gestured) return; const L = this.menuList(); if (!L.length) return; this.menuI %= L.length; this.play(L[this.menuI], 'menu'); },
  menuNext(auto) {
    const L = this.menuList(), m = Store.data.menu; if (!L.length) return; if (auto && m.repeat === 'one') return this.play(L[this.menuI % L.length], 'menu');
    if (auto && m.repeat === 'off' && !m.shuffle && this.menuI >= L.length - 1) { this.cur = null; this.box(false); return this.emit(); }
    this.menuI = m.shuffle && L.length > 1 ? (this.menuI + 1 + Math.floor(Math.random()*(L.length - 1))) % L.length : (this.menuI + 1) % L.length; this.play(L[this.menuI], 'menu');
  },
  menuPrev() { const L = this.menuList(); if (!L.length) return; this.menuI = (this.menuI - 1 + L.length) % L.length; this.play(L[this.menuI], 'menu'); },
  menuToggle() { this.cur?.kind === 'menu' ? this.togglePause() : this.startMenu(); },
  userGesture() { if (this.gestured) return; this.gestured = true; if (GS.estado === 'MENU' && !this.cur) this.startMenu(); },
  enterMenu() { this.stop(['chant', 'champion', 'test']); if (!this.cur) this.startMenu(); },
  // ---- cantos por equipe / campeão (identificação pelo ESTADO da partida, não por texto da tela) ----
  teamKey(slot) { return GS.equipes[slot]?.key; },
  chantOf(slot) { const e = Store.data.chants[this.teamKey(slot)]; return e && e.enabled ? e : null; },
  chant(slot) {
    const e = this.chantOf(slot);
    if (!e) { this.stop(['chant']); if (Store.data.play.keepMenuInMatch && !this.cur) this.startMenu(); return null; }   // sem canto: segue com o áudio padrão
    if (this.cur?.entry.id === e.id && this.playing) return e; this.play(e, 'chant'); return e;
  },
  champion(slot) {                                                  // só com partida ENCERRADA e vencedor válido
    if (slot !== 0 && slot !== 1) return null; const c = Store.data.champion; let e = null;
    if (c.mode === 'team') e = this.chantOf(slot) || c.defaultSong; else if (c.mode === 'exclusive') e = c.exclusive; else if (c.mode === 'default') e = c.defaultSong;
    if (!e || !e.enabled) { this.stop(['chant', 'menu']); return null; } this.stop(['chant', 'menu']); this.play(e, 'champion'); return e;
  },
  duck() {                                                          // abaixa a música no chute para os efeitos aparecerem; restaura depois
    if (!Store.data.play.duckOnKick) return; this.duckF = .25; this.applyVol(); clearTimeout(this._t);
    this._t = setTimeout(() => { const step = () => { this.duckF = Math.min(1, this.duckF + .15); this.applyVol(); if (this.duckF < 1) this._t = setTimeout(step, 120); }; step(); }, 1500);
  },
  init() {
    if (this.inited) return; this.inited = true; const P = () => Store.data.play;
    Events.on('partida_iniciada', () => { if (!Store.data.play.keepMenuInMatch) this.stop(['menu', 'test']); if (P().chantStart === 'apresentacao') this.chant(0); });
    Events.on('cobranca_mudou', e => { if (P().chantStart === 'preparacao') this.chant(e.cobrador); });
    Events.on('chute', e => { if (P().chantStart === 'cobranca') this.chant(e.equipe); this.duck(); });
    Events.on('gol', e => { if (P().chantStart === 'gol') this.chant(e.equipe); });
    Events.on('partida_encerrada', e => this.champion(e.vencedor));
    Events.on('partida_reiniciada', () => this.stop(['chant', 'champion']));
  }
};
return {AM};})();
const {drawScene,setTeams,DBG}=(function(){
// VETORES 3D ([x, y, z]) e cor: funções puras usadas pelo motor 3D, pelo rig, pela física da bola e pelas ferramentas.
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul = (a, s) => [a[0]*s, a[1]*s, a[2]*s];
const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2], cross = (a, b) => [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]), norm = a => { const l = len(a) || 1; return [a[0]/l, a[1]/l, a[2]/l]; }, lerp = (a, b, t) => [a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t, a[2] + (b[2]-a[2])*t];
const cache = new Map();
function shade(hex, f) {                       // clareia (f>1) ou escurece (f<1) uma cor #rrggbb
  const key = hex + f; let v = cache.get(key); if (v) return v; const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, (n >> 16)*f | 0), g = Math.min(255, (n >> 8 & 255)*f | 0), b = Math.min(255, (n & 255)*f | 0); v = `rgb(${r},${g},${b})`; cache.set(key, v); return v;
}

// APARÊNCIA-BASE DO ATLETA (usada pelo motor 3D e pelo procedural): paletas de pele/cabelo/chuteira e faceOf, o rosto determinístico por atleta.
// A aparência real dos titulares vem de js/lineups/appearance.js; faceOf completa o resto (proporções do rosto, olhos, chuteira).
const SKINS = ['#f6d0a8', '#e8b88a', '#c68642', '#a0693a', '#7a4a2a', '#53341f'], HAIRC = ['#15110e', '#2b1d12', '#4a3020', '#7a5230', '#c9a45c', '#a6401e', '#9aa0a6', '#e8d9b0'], BOOTS = ['#14161a', '#f4f4f4', '#ff5a1f', '#2bd96b', '#2f7bff', '#ffd23f'];
const STYLES = ['short', 'buzz', 'long', 'afro', 'curly', 'bald', 'bun'];
const hash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rngOf = seed => { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0)/4294967296; }; };
const faces = new Map();
function faceOf(key, hint = {}) {               // aparência determinística por atleta (rosto, cabelo, pele, porte)
  const id = String(key) + (hint.hair || ''); let f = faces.get(id); if (f) return f; const r = rngOf(hash(id));
  const skin = r() < .5 ? 1 + (r()*3 | 0) : (r()*6 | 0), style = hint.hair && STYLES.includes(hint.hair) ? hint.hair : STYLES[r()*STYLES.length | 0];
  f = { skin: SKINS[skin], skinI: skin, hairC: HAIRC[skin >= 4 ? (r()*3 | 0) : (r()*8 | 0)], style, build: .92 + r()*.16, height: .96 + r()*.08, eyeW: .034 + r()*.012, nose: .8 + r()*.45, brow: .7 + r()*.7, mouth: .8 + r()*.5, ear: .8 + r()*.5, eyeC: ['#3b2a1a', '#2a4a6b', '#3d5a2f', '#1b1b1b'][r()*4 | 0], boot: BOOTS[r()*BOOTS.length | 0], head: .94 + r()*.12 }; faces.set(id, f); return f;
}
// ---- camisa: textura que dá a volta no tronco (frente em u=.25, costas em u=.75; a costura fica na lateral) ----

// CAMISA PROCEDURAL (canvas 512×192, layout "wrap"): listras/faixas, número, nome e escudo. Usada pelo goleiro e por clubes sem textura do pack.
const shirts = new Map(), crestImgs = new Map();
function crestImg(key) { if (!CRESTS.includes(key) || typeof Image === 'undefined') return null; let i = crestImgs.get(key); if (!i) { i = new Image(); i.onload = () => { for (const k of [...shirts.keys()]) if (k.startsWith(key + '|')) shirts.delete(k); }; i.src = `assets/crests/${key}.png`; crestImgs.set(key, i); } return i.complete && i.naturalWidth ? i : null; }
const lumOf = h => { const n = parseInt(h.slice(1), 16); return (.3*(n >> 16) + .59*(n >> 8 & 255) + .11*(n & 255))/255; };
function shirtTex(kit, p) {
  const key = [kit.key || kit.c1, kit.pat, kit.keeper ? 'k' : '', p.nome, p.num, !!crestImg(kit.key)].join('|'); let cv = shirts.get(key); if (cv) return cv; if (typeof document === 'undefined') return null;
  cv = document.createElement('canvas'); cv.width = 512; cv.height = 192; const c = cv.getContext('2d'); c.fillStyle = kit.c1; c.fillRect(0, 0, 512, 192); c.fillStyle = kit.c2;
  if (kit.pat === 'v') for (let x = 16; x < 512; x += 64) c.fillRect(x, 0, 32, 192); else if (kit.pat === 'h') for (let y = 12; y < 192; y += 42) c.fillRect(0, y, 512, 21);
  else if (kit.pat === 's') { c.fillRect(0, 70, 512, 38); c.fillStyle = kit.c3; c.fillRect(0, 70, 512, 6); c.fillRect(0, 102, 512, 6); } else if (kit.pat === 'd') { c.save(); c.translate(128, 96); c.rotate(-.9); c.fillRect(-300, -22, 600, 44); c.restore(); c.save(); c.translate(384, 96); c.rotate(.9); c.fillRect(-300, -22, 600, 44); c.restore(); } else if (kit.pat === 'f') c.fillRect(0, 0, 256, 192);
  const ink = lumOf(kit.c1) > .55 ? '#101820' : '#fff', stroke = ink === '#fff' ? 'rgba(0,0,0,.45)' : 'rgba(255,255,255,.5)'; c.textAlign = 'center'; c.fillStyle = ink; c.strokeStyle = stroke; c.lineWidth = 4;
  const num = p.noNum ? '?' : String(p.num);
  c.font = '900 80px Arial'; c.strokeText(num, 384, 126); c.fillText(num, 384, 126); c.font = '700 20px Arial'; c.fillText((p.nome || '').slice(0, 11), 384, 50);   // COSTAS: nome em cima, número grande
  if (!kit.keeper) { c.font = '900 30px Arial'; c.strokeText(num, 96, 70); c.fillText(num, 96, 70); }                                                     // FRENTE: número pequeno
  c.fillStyle = kit.c2; c.fillRect(0, 0, 512, 7);                                                                             // gola
  if (kit.keeper) { shirts.set(key, cv); return cv; }
  const ci = crestImg(kit.key), cx = 168, cy = 62;                                                                                                          // ESCUDO no peito esquerdo (lado direito de quem olha)
  if (ci) c.drawImage(ci, cx - 17, cy - 21, 34, 42); else { c.fillStyle = shade(kit.c2, .85); c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(cx - 16, cy - 20); c.lineTo(cx + 16, cy - 20); c.lineTo(cx + 16, cy + 4); c.quadraticCurveTo(cx + 16, cy + 18, cx, cy + 24); c.quadraticCurveTo(cx - 16, cy + 18, cx - 16, cy + 4); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.font = '900 13px Arial'; c.fillText((kit.sigla || '').slice(0, 3), cx, cy + 5); }
  shirts.set(key, cv); return cv;
}

// Mini motor 3D próprio (sem dependências): câmera em perspectiva real, projeção, fila de profundidade (algoritmo do pintor)
// e primitivas (esfera, cápsula, quadrilátero, textura mapeada em plano). Coordenadas: x direita · y cima · z em direção à câmera.
const W = 960, H = 540;
class Engine {
  constructor() { this.pos = [0, 2.8, 22]; this.tgt = [0, 1.15, 0]; this.fov = 30; this.items = []; this.c = null; }
  begin(c) { this.c = c; this.items.length = 0; const f = norm(sub(this.tgt, this.pos)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f); this.f = f; this.r = r; this.u = u; this.focal = (H/2)/Math.tan(this.fov*Math.PI/360); }
  proj(p) {                                           // → [x, y, profundidade, escala px/m] ou null atrás da câmera
    const d = sub(p, this.pos), z = dot(d, this.f); if (z < .2) return null; const k = this.focal/z;
    return [W/2 + dot(d, this.r)*k, H/2 - dot(d, this.u)*k, z, k];
  }
  push(z, fn) { this.items.push({ z, fn }); }
  flush() { const it = this.items; it.sort((a, b) => b.z - a.z); const c = this.c; for (let i = 0; i < it.length; i++) it[i].fn(c); it.length = 0; }
  sphere(p, r, col, grad = true) {
    const q = this.proj(p); if (!q) return; const rad = r*q[3];
    this.push(q[2], c => { if (grad) { const g = c.createRadialGradient(q[0] - rad*.35, q[1] - rad*.4, rad*.1, q[0], q[1], rad); g.addColorStop(0, shade(col, 1.25)); g.addColorStop(1, shade(col, .72)); c.fillStyle = g; } else c.fillStyle = col; c.beginPath(); c.arc(q[0], q[1], rad, 0, 7); c.fill(); });
  }
  capsule(a, b, r, col) {                             // membro: cilindro com pontas redondas, com realce de luz
    const qa = this.proj(a), qb = this.proj(b); if (!qa || !qb) return; const w = r*(qa[3] + qb[3]);
    this.push((qa[2] + qb[2])/2 - .01, c => { c.lineCap = 'round'; c.strokeStyle = shade(col, .7); c.lineWidth = w; c.beginPath(); c.moveTo(qa[0], qa[1]); c.lineTo(qb[0], qb[1]); c.stroke();
      c.strokeStyle = col; c.lineWidth = w*.66; c.beginPath(); c.moveTo(qa[0] - w*.08, qa[1] - w*.1); c.lineTo(qb[0] - w*.08, qb[1] - w*.1); c.stroke(); });
  }
  limb(a, b, r0, r1, col) {                           // membro afilado (cone com pontas redondas) com gradiente de luz vinda de cima-esquerda
    const qa = this.proj(a), qb = this.proj(b); if (!qa || !qb) return; const ra = r0*qa[3], rb = r1*qb[3];
    this.push((qa[2] + qb[2])/2 - .01, c => {
      const dx = qb[0] - qa[0], dy = qb[1] - qa[1], L = Math.hypot(dx, dy) || 1, nx = -dy/L, ny = dx/L, sg = (nx*-.5 + ny*-.8) > 0 ? 1 : -1, mx = (qa[0] + qb[0])/2, my = (qa[1] + qb[1])/2, rr = (ra + rb)/2 + .5;
      const g = c.createLinearGradient(mx - nx*sg*rr, my - ny*sg*rr, mx + nx*sg*rr, my + ny*sg*rr); g.addColorStop(0, shade(col, .6)); g.addColorStop(.5, col); g.addColorStop(1, shade(col, 1.2)); c.fillStyle = g;
      c.beginPath(); c.moveTo(qa[0] + nx*ra, qa[1] + ny*ra); c.lineTo(qb[0] + nx*rb, qb[1] + ny*rb); c.lineTo(qb[0] - nx*rb, qb[1] - ny*rb); c.lineTo(qa[0] - nx*ra, qa[1] - ny*ra); c.closePath(); c.fill();
      c.beginPath(); c.arc(qa[0], qa[1], ra, 0, 7); c.fill(); c.beginPath(); c.arc(qb[0], qb[1], rb, 0, 7); c.fill(); });
  }
  ellip(p, rx, ry, up, col, z) {                      // elipsoide (cabeça, mão, bota) orientado pelo vetor "para cima"
    const q = this.proj(p), qu = this.proj(add(p, mul(up, .1))); if (!q || !qu) return; const ang = Math.atan2(qu[0] - q[0], -(qu[1] - q[1])), a = rx*q[3], b = ry*q[3];
    this.push(z ?? q[2], c => { const g = c.createRadialGradient(q[0] - a*.35, q[1] - b*.4, Math.min(a, b)*.1, q[0], q[1], Math.max(a, b)); g.addColorStop(0, shade(col, 1.2)); g.addColorStop(1, shade(col, .7)); c.fillStyle = g; c.beginPath(); c.ellipse(q[0], q[1], a, b, ang, 0, 7); c.fill(); });
  }
  quad(pts, col, z, alpha = 1) {
    const q = pts.map(p => this.proj(p)); if (q.some(v => !v)) return;
    this.push(z ?? q.reduce((s, v) => s + v[2], 0)/q.length, c => { c.globalAlpha = alpha; c.fillStyle = col; c.beginPath(); c.moveTo(q[0][0], q[0][1]); for (let i = 1; i < q.length; i++) c.lineTo(q[i][0], q[i][1]); c.closePath(); c.fill(); c.globalAlpha = 1; });
  }
  tex(img, TL, TR, BL, z) {                           // textura mapeada num plano 3D (transformação afim): nomes/números "impressos" no tecido
    const a = this.proj(TL), b = this.proj(TR), d = this.proj(BL); if (!a || !b || !d) return; const iw = img.width, ih = img.height;
    this.push(z ?? a[2], c => { c.save(); c.transform((b[0] - a[0])/iw, (b[1] - a[1])/iw, (d[0] - a[0])/ih, (d[1] - a[1])/ih, a[0], a[1]); c.drawImage(img, 0, 0); c.restore(); });
  }
  ground(p, rx, rz, col, alpha, z) {                  // elipse achatada no chão (sombras)
    const q = this.proj(p), qx = this.proj([p[0] + rx, p[1], p[2]]), qz = this.proj([p[0], p[1], p[2] - rz]); if (!q || !qx || !qz) return;
    this.push(z ?? 1e3, c => { c.globalAlpha = alpha; c.fillStyle = col; c.beginPath(); c.ellipse(q[0], q[1], Math.abs(qx[0] - q[0]), Math.abs(qz[1] - q[1]), 0, 0, 7); c.fill(); c.globalAlpha = 1; });
  }
}

// Esqueleto 3D articulado: cinemática direta (FK) + cinemática inversa de 2 ossos (IK) para pernas e braços.
// Eixos locais: x direita · y cima · z para FRENTE do personagem. Poses do cobrador, do goleiro e comemorações.
const GOAL_W = 7.32, GOAL_H = 2.44, SPOT_Z = 11, BALL_R = .11;
const BALL0 = [0, BALL_R, SPOT_Z];
const goalToWorld = (gx, gy) => [(gx - .5)*GOAL_W, gy*GOAL_H, 0];
const saveCategory = (th, mag) => mag < .06 ? 'central' : th > .62 ? 'alta' : th < .3 ? 'baixa' : 'media';   // central · alta · média · baixa
const sm = t => { t = Math.min(1, Math.max(0, t)); return t*t*(3 - 2*t); };
const LEN = { thigh: .43, shin: .44, uarm: .3, farm: .27, torso: .5, hipW: .1, shW: .19, head: .115 };
// ---- matrizes 3x3 ----
const rx = a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; }, ry = a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; }, rz = a => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
const mm = (a, b) => { const o = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i*3 + j] = a[i*3]*b[j] + a[i*3 + 1]*b[3 + j] + a[i*3 + 2]*b[6 + j]; return o; };
const ap = (m, v) => [m[0]*v[0] + m[1]*v[1] + m[2]*v[2], m[3]*v[0] + m[4]*v[1] + m[5]*v[2], m[6]*v[0] + m[7]*v[1] + m[8]*v[2]];
function ik2(A, T, l1, l2, pole) {             // 2 ossos: devolve [articulação (joelho/cotovelo), ponta alcançada]
  let d = sub(T, A), D = len(d); const mx = l1 + l2 - 1e-3; if (D > mx) { d = mul(d, mx/D); D = mx; } if (D < .05) { d = [0, -.05, 0]; D = .05; }
  const n = mul(d, 1/D), a = (l1*l1 - l2*l2 + D*D)/(2*D), h = Math.sqrt(Math.max(0, l1*l1 - a*a)); let p = sub(pole, mul(n, dot(pole, n))); p = norm(p);
  return [add(A, add(mul(n, a), mul(p, h))), add(A, d)];
}
// P: { root:[x,y,z], yaw, lean, twist, roll, py(altura do quadril), lift, head:[pitch], hipL/hipR:[pitch,abd,knee], armL/armR:[pitch,abd,elbow], ikL/ikR:{t,w}, ikArmL/ikArmR:{t,w} }
function humanJoints(P) {
  const R0 = ry(P.yaw || 0), Rp = mm(R0, mm(ry(P.twist || 0), rz(0))), Rt = mm(Rp, mm(rx(P.lean || 0), rz(0)));
  const rt = P.root, py = P.py ?? .93, pelvis = [rt[0], py, rt[2]], J = { pelvis };
  const out = [mm(Rp, [1, 0, 0, 0, 1, 0, 0, 0, 1])];
  const leg = (s, h) => { const hip = add(pelvis, ap(Rp, [s*LEN.hipW, 0, 0])), Rh = mm(Rp, mm(rx(-h[0]), rz(s*h[1]))), kn = add(hip, ap(Rh, [0, -LEN.thigh, 0])), Rk = mm(Rh, rx(h[2])), an = add(kn, ap(Rk, [0, -LEN.shin, 0])), toe = add(an, ap(Rk, [0, -.07, .17])); return { hip, kn, an, toe }; };
  const L = leg(-1, P.hipL || [0, .08, .1]), R = leg(1, P.hipR || [0, .08, .1]);
  const chest = add(pelvis, ap(Rt, [0, LEN.torso, 0])), neck = add(pelvis, ap(Rt, [0, LEN.torso + .06, 0])), Rh2 = mm(Rt, rx(P.head?.[0] || 0)), head = add(chest, ap(Rh2, [0, .06 + LEN.head, .01]));
  const arm = (s, a) => { const sh = add(chest, ap(Rt, [s*LEN.shW, -.04, 0])), Ra = mm(Rt, mm(rx(-a[0]), rz(s*a[1]))), el = add(sh, ap(Ra, [0, -LEN.uarm, 0])), Re = mm(Ra, rx(-a[2])), ha = add(el, ap(Re, [0, -LEN.farm, 0])); return { sh, el, ha }; };
  const AL = arm(-1, P.armL || [.2, .15, .5]), AR = arm(1, P.armR || [.2, .15, .5]);
  Object.assign(J, { hipL: L.hip, knL: L.kn, anL: L.an, toeL: L.toe, hipR: R.hip, knR: R.kn, anR: R.an, toeR: R.toe, chest, neck, head, shL: AL.sh, elL: AL.el, haL: AL.ha, shR: AR.sh, elR: AR.el, haR: AR.ha });
  const fwd = ap(Rp, [0, 0, 1]), right = ap(Rp, [1, 0, 0]); J.fwd = fwd; J.right = right; J.up = ap(Rt, [0, 1, 0]); J.tfwd = ap(Rt, [0, 0, 1]); J.tright = ap(Rt, [1, 0, 0]); J.hfwd = ap(Rh2, [0, 0, 1]); J.hup = ap(Rh2, [0, 1, 0]); J.hright = ap(Rh2, [1, 0, 0]);
  const pts = ['pelvis', 'hipL', 'knL', 'anL', 'toeL', 'hipR', 'knR', 'anR', 'toeR', 'chest', 'neck', 'head', 'shL', 'elL', 'haL', 'shR', 'elR', 'haR'];
  // rolagem lateral do corpo inteiro (mergulho) em torno do quadril + elevação (salto)
  if (P.roll) { const c = Math.cos(P.roll), s = Math.sin(P.roll), o = J.pelvis.slice(); pts.forEach(k => { const p = J[k], dx = p[0] - o[0], dy = p[1] - o[1]; J[k] = [o[0] + dx*c - dy*s, o[1] + dx*s + dy*c, p[2]]; }); [J.up, J.tright, J.hfwd, J.hup, J.hright, J.fwd, J.right, J.tfwd].forEach(v => { const x = v[0]; v[0] = x*c - v[1]*s; v[1] = x*s + v[1]*c; }); }
  // pernas por IK (pé em alvo absoluto no mundo; w = mistura FK→IK)
  [['L', -1], ['R', 1]].forEach(([n, s]) => { const ik = P['ik' + n]; if (!ik) return; const hip = J['hip' + n], an0 = J['an' + n], T = lerp(an0, ik.t, ik.w), [kn, an] = ik2(hip, T, LEN.thigh, LEN.shin, J.fwd.map((v, i) => v + (i === 0 ? s*.15 : 0)));
    const tdir = norm(sub(an, kn)); J['kn' + n] = kn; J['an' + n] = an; J['toe' + n] = add(an, add(mul(J.fwd, .17), [0, -.07, 0])); void tdir; });
  // altura: se nenhuma perna está em IK, apoia o pé mais baixo no chão; senão respeita os alvos (já absolutos)
  const lift = P.lift || 0, anyIK = (P.ikL && P.ikL.w > .5) || (P.ikR && P.ikR.w > .5);
  if (!anyIK && !P.free) { const minY = Math.min(J.toeL[1], J.toeR[1], J.anL[1] - .07, J.anR[1] - .07); P._dy = -minY + lift; } else P._dy = lift;
  if (P._dy) Object.keys(J).forEach(k => { if (Array.isArray(J[k]) && J[k].length === 3 && !['fwd', 'right', 'up', 'tfwd', 'tright', 'hfwd', 'hup', 'hright'].includes(k)) J[k] = [J[k][0], J[k][1] + P._dy, J[k][2]]; });
  [['L', -1], ['R', 1]].forEach(([n, s]) => { const ik = P['ikArm' + n]; if (!ik) return; const sh = J['sh' + n], T = lerp(J['ha' + n], ik.t, ik.w), [el, ha] = ik2(sh, T, LEN.uarm, LEN.farm, [s*.6, -.3, -.5]); J['el' + n] = el; J['ha' + n] = ha; });
  Object.keys(J).forEach(k => { const v = J[k]; if (Array.isArray(v) && v[1] < .03 && !['fwd', 'right', 'up', 'tfwd', 'tright', 'hfwd', 'hup', 'hright'].includes(k)) v[1] = .03; });   // nada atravessa o gramado
  return J;
}

// ================= POSES =================
const P0 = [-.95, 0, 12.45], P1 = [-.62, 0, 11.8], P2 = [-.38, 0, 11.22], P3 = [-.2, 0, 10.95], PS = [-2.6, 0, 16.6];
const lN = (a, b, t) => a + (b - a)*t, ease = u => Math.pow(Math.min(1, Math.max(0, u)), 1.7);
const base = () => ({ root: P0.slice(), yaw: Math.PI, lean: .05, twist: 0, head: [.25], hipL: [0, .06, .12], hipR: [0, .06, .12], armL: [.3, .2, .6], armR: [.3, .2, .6] });
// Cobrador (chuta com a perna 'L', que fica à direita da tela; apoio em 'R'). tc = tempo relativo ao CONTATO (s).
const KICK_T0 = -.55;
const BACK = [-.2, .55, 11.8], CONT = [0, .18, 11.29], FOL = [.1, .85, 10], LAND = [.02, .08, 10.78], PF = [-.42, .08, 11.06];
function kickerPose(m) {
  const P = base();
  if (m.mode === 'walkin') { const u = Math.min(1, m.t/.9), s = Math.sin(u*Math.PI*2*2.2); P.root = lerp(PS, P0, sm(u)); P.lean = .1; P.hipL = [.5*s, .05, Math.max(0, -s)*.9 + .1]; P.hipR = [-.5*s, .05, Math.max(0, s)*.9 + .1]; P.armL = [-.5*s, .15, .5]; P.armR = [.5*s, .15, .5]; }
  else if (m.mode === 'idle') { const t = m.t, s = Math.sin(t*2); P.root = [P0[0] + Math.sin(t*.9)*.04, 0, P0[2]]; P.lean = .03 + s*.015; P.head = [.14 + Math.sin(t*.7)*.07]; P.armL = [.5, .35, 1 + s*.05]; P.armR = [.5, .35, 1 - s*.05]; P.hipL = [.04*Math.sin(t*.9), .1, .1]; P.hipR = [-.04*Math.sin(t*.9), .1, .1]; }
  else if (m.mode === 'kick') {
    const t = m.tc;
    if (t < -.3) { const u = (t - KICK_T0)/.25, s = Math.sin(u*Math.PI*2); P.root = lerp(P0, P1, sm(u)); P.lean = .12; P.hipL = [.5*s, .05, Math.max(0, -s)*.9 + .1]; P.hipR = [-.5*s, .05, Math.max(0, s)*.9 + .1]; P.armL = [-.5*s, .15, .5]; P.armR = [.5*s, .15, .5]; }   // 2 passos de aproximação
    else if (t < -.12) { const u = (t + .3)/.18, e = u*.6 + sm(u)*.4; P.root = lerp(P1, P2, e); P.lean = lN(.12, -.05, e); P.ikR = { t: PF, w: sm(u*2.5) }; P.ikL = { t: lerp([-.25, .3, 11.5], BACK, e), w: sm(u*3) }; P.armR = [lN(.3, 1.2, e), lN(.2, .8, e), .5]; P.armL = [lN(.3, -.6, e), lN(.2, .7, e), .3]; }   // apoia o pé e leva a perna para trás
    else if (t < 0) { const u = (t + .12)/.12, e = ease(u); P.root = P2.slice(); P.twist = lN(0, -.4, sm(u)); P.lean = lN(-.05, .2, sm(u)); P.ikR = { t: PF, w: 1 }; const f = lerp(BACK, CONT, e); f[1] += .25*Math.sin(Math.PI*e); P.ikL = { t: f, w: 1 }; P.armR = [1.2, .8, .5]; P.armL = [-.6, .7, .3]; }   // golpe até o contato
    else if (t < .3) { const u = t/.3, e = sm(u); P.root = add(P2, mul([.08, 0, -.22], e)); P.twist = lN(-.4, -.2, e); P.lean = lN(.2, .25, e); P.ikR = { t: add(PF, [0, 0, -.18*e]), w: 1 }; const f = lerp(CONT, FOL, e); f[1] += .15*Math.sin(Math.PI*e); P.ikL = { t: f, w: 1 }; P.armR = [lN(1.2, .6, e), .8, .5]; P.armL = [lN(-.6, -.2, e), .7, .3]; }   // acompanhamento
    else { const u = (t - .3)/.4, e = sm(u); P.root = lerp(add(P2, [.08, 0, -.22]), P3, e); P.twist = lN(-.2, 0, e); P.lean = lN(.25, .05, e); P.ikR = { t: lerp(add(PF, [0, 0, -.18]), [-.3, .08, 10.9], e), w: 1 }; P.ikL = { t: lerp(FOL, LAND, e), w: 1 }; P.armR = [lN(.6, .3, e), lN(.8, .2, e), .6]; P.armL = [lN(-.2, .3, e), lN(.7, .2, e), .6]; }   // recupera o equilíbrio
  } else {                                              // reação depois da jogada (m.type: 'gol' | 'falha' | 'normal')
    P.root = P3.slice(); P.ikR = { t: [-.3, .08, 10.9], w: 1 }; P.ikL = { t: LAND, w: 1 }; P.lean = .05; const d = m.d || 0;
    if (m.type === 'gol') { const up = d < .9; P.armL = up ? [2.9, .35, .2] : [.3, .2, .6]; P.armR = [.3, .2, .6]; P.lift = Math.max(0, .08 - d*.2); }
    else if (m.type === 'falha') { P.lean = .3; P.head = [.7]; P.armL = [2.5, .25, 2.3]; P.armR = [2.5, .25, 2.3]; }
  }
  return P;
}
// Comemoração coletiva (fim da disputa) e decepção do derrotado
function cheerPose(t, i, pos, yaw) { const s = Math.sin(t*7 + i*1.3), P = base(); P.root = pos; P.yaw = yaw; P.lift = Math.abs(s)*.28; P.lean = -.05; P.head = [-.2]; P.hipL = [.2, .2, .5]; P.hipR = [.2, .2, .5];
  P.armL = [[2.9, 3, 2.7][i % 3], [.5, .8, .4][i % 3], .2]; P.armR = [[2.9, .6, 2.7][i % 3], [.5, .5, .4][i % 3], [.2, 1.6, .2][i % 3]]; return P; }
function dejectedPose(t, pos, yaw) { const P = base(); P.root = pos; P.yaw = yaw; P.lean = .5; P.head = [1]; P.hipL = [.9, .1, 1.5]; P.hipR = [.9, .1, 1.5]; P.armL = [1.9, .1, 2.7]; P.armR = [1.9, .1, 2.7]; return P; }   // cabisbaixo, mãos no rosto
// Goleiro: espera → antecipação → reação (4 categorias) → contato/tentativa → queda → recuperação
function keeperPose(k, b, res, d, now, ballW) {
  const xw = (k.x - .5)*GOAL_W, P = { root: [xw, 0, .55], yaw: 0, lean: .22, twist: 0, head: [.1], hipL: [.5, .24, .95], hipR: [.5, .24, .95], armL: [1, .75, 1], armR: [1, .75, 1] }, info = { cat: 'espera', T: null };
  const sw = Math.sin(now*1.6); P.root[0] += sw*.1; P.hipL[0] = .5 + Math.max(0, sw)*.25; P.hipR[0] = .5 + Math.max(0, -sw)*.25; P.armL[0] = 1 + Math.sin(now*2.2)*.12; P.armR[0] = 1 - Math.sin(now*2.2)*.12;   // passinhos laterais de espera
  if (b && b.t > -.2 && (k.t0 == null || b.t < k.t0)) { const c = sm((b.t + .2)/.2); P.hipL[2] += .35*c; P.hipR[2] += .35*c; P.lean += .08*c; }                                          // antecipação: agacha
  if (!b || k.t0 == null) return { P, info };
  const dir = Math.sign(k.tx - .5) || 1, th = k.th ?? .4, cat = saveCategory(th, Math.abs(k.tx - .5)); info.cat = cat;
  const p = Math.min(1, Math.max(0, (b.t - k.t0)/.6)), e = 1 - (1 - p)*(1 - p), s1 = Math.sin(p*Math.PI);
  let A = 0, lift = 0, tgt = goalToWorld(k.tx, th); if (res === 'defesa' && ballW) tgt = lerp(tgt, ballW, sm(p*1.3));
  P.hipL[0] = .2; P.hipR[0] = .2; P.root[0] = xw;
  const crouch = cat === 'central' && th <= .62;
  if (cat === 'alta') { A = .5; lift = s1*.55; P.hipL = [-.3, .3, .8]; P.hipR = [-.3, .3, .8]; P.lean = .05; }
  else if (cat === 'media') { A = 1.05; lift = s1*.42; P.hipL = [-.1, .4, .6]; P.hipR = [-.1, .4, .9]; P.lean = .1; }
  else if (cat === 'baixa') { A = 1.4; lift = s1*.16; P.hipL = [-.2, .3, .7]; P.hipR = [-.2, .3, .9]; P.lean = .05; }
  else if (!crouch) { lift = s1*.55; P.hipL = [-.2, .2, .7]; P.hipR = [-.2, .2, .7]; P.lean = 0; }                                                                // central alta: salto reto
  else { P.hipL = [.9*e + .3, .3, 1.5*e + .5]; P.hipR = [.9*e + .3, .3, 1.5*e + .5]; P.lean = .25 + .35*e; }                                                          // central: agachamento e encaixe
  P.roll = -dir*A*e; P.lift = lift; info.T = tgt;
  if (d > 0) {                                                                                                                                                         // queda e recuperação
    P.lift = lift*Math.max(0, 1 - d/.3); const rec = sm((d - 1.0)/.7); P.roll = -dir*A*(1 - rec); P.root[0] = lN(xw, 0, rec);
    if (rec > 0) { P.hipL = [.5, .24, .95]; P.hipR = [.5, .24, .95]; P.lean = .22; }
    info.T = rec > .3 ? null : tgt; if (res === 'gol' && d > .4) info.sad = true; if (res === 'defesa' && d > .4) info.happy = true;
  }
  P.ikArmL = P.ikArmR = info.T ? { t: info.T, w: sm(p*2.2) } : null; if (!info.T) { delete P.ikArmL; delete P.ikArmR; } else { P.ikArmL = { t: add(info.T, [-.12, 0, 0]), w: sm(p*2.2) }; P.ikArmR = { t: add(info.T, [.12, 0, 0]), w: sm(p*2.2) }; }
  return { P, info };
}

// HUD 2D (placar, cobrador, mensagens) desenhado por cima da cena 3D
function hud(c, game, res, b) {
  const [a, bb] = GS.equipes; if (!a) return; c.fillStyle = 'rgba(0,0,0,.78)'; c.fillRect(250,6,460,64); c.font = '700 18px system-ui'; c.textAlign = 'left'; c.fillStyle = a.c1; c.fillRect(256,12,8,52); c.fillStyle = '#fff'; c.fillText(a.nome,272,30); c.textAlign = 'right'; c.fillText(bb.nome,694,30); c.fillStyle = bb.c1; c.fillRect(696,12,8,52);
  c.textAlign = 'center'; c.font = '900 34px Impact, sans-serif'; c.fillStyle = '#ffe66d'; c.fillText(`${GS.placar[0]} - ${GS.placar[1]}`,480,38); c.font = '13px system-ui'; c.fillStyle = '#aaa'; c.fillText(`Cobrança ${GS.cobranca}`,480,62);
  const m = game.m; if (!m) return; [0,1].forEach(q => { const n = Math.max(5, m.marks[q].length); for (let i = 0; i < n; i++) { const v = m.marks[q][i]; c.fillStyle = v === 'g' ? '#38b000' : v === 'd' ? '#4cc9f0' : v === 'x' ? '#e63946' : '#555'; c.beginPath(); c.arc(q ? 700 - i*16 : 260 + i*16, 62, 5, 0, 7); c.fill(); } });
  if (game.fin) { c.font = '900 54px Impact, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ffe66d'; c.strokeStyle = '#000'; c.lineWidth = 6; const tx = `${GS.equipes[GS.vencedor].nome.toUpperCase()} VENCE!`; c.strokeText(tx, 480, 420); c.fillText(tx, 480, 420); return; }
  const kt = GS.cobrador === 0 ? a : bb, p = pickKicker(kt, GS.cobranca, game.escolha[GS.cobrador]); c.fillStyle = 'rgba(0,0,0,.75)'; c.fillRect(10,500,230,30); c.fillStyle = kt.c1; c.fillRect(10,500,6,30); c.fillStyle = '#fff'; c.textAlign = 'left'; c.font = '700 14px system-ui'; c.fillText(`${game.two ? 'JOGADOR ' + (GS.cobrador+1) + ' · ' : ''}${p.star ? '★ ' : ''}${p.nome} — ${p.noNum ? 'nº ?' : p.num}${p.pending ? ' (elenco pendente)' : ''}`.slice(0, 34), 24, 520);
  if (game.dec && !res && !game.fin) { c.globalAlpha = .6 + .4*Math.sin(performance.now()/150); c.font = '900 26px Impact, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ff2d55'; c.fillText('COBRANÇA DECISIVA', 480, 104); c.globalAlpha = 1; }
  if (res) { c.font = '900 64px Impact, sans-serif'; c.textAlign = 'center'; c.fillStyle = { gol:'#ffe66d', defesa:'#4cc9f0', fora:'#ccc', trave:'#ff9f1c' }[res]; c.strokeStyle = '#000'; c.lineWidth = 6; const tx = { gol:'GOL!', defesa:'DEFESA!', fora:'PARA FORA', trave:'NA TRAVE!' }[res]; c.strokeText(tx,480,420); c.fillText(tx,480,420); }
  else { c.font = '600 16px system-ui'; c.textAlign = 'center'; c.fillStyle = '#fff'; c.fillText('', 0, 0); if (GS.estado === 'AGUARDANDO_COBRANCA') c.fillText('Clique = chute rasteiro · segure = mais alto · solte para chutar', 560, 522); else if (GS.estado === 'DEFESA_DO_GOLEIRO') c.fillText('Defenda! ← esquerda · ↑ centro · → direita', 560, 522); }
}

// Bola: desenho INSPIRADO no visual da bola Nike/CBF do Brasileirão (branca com formas azuis e toques verdes — referência: CBF/Nike Flight 2023).
// NÃO é a textura oficial nem a bola da temporada atual (não identificada em fonte confiável). Para usar uma textura licenciada, troque drawBall.
function drawBall(c, P, b) {
  c.fillStyle = 'rgba(0,0,0,.32)'; c.beginPath(); c.ellipse(P.x + 6*P.s, P.gy, 14*P.s, 4.5*P.s, 0, 0, 7); c.fill();        // sombra no gramado
  const t = b ? Math.max(0, b.t) : 0, spin = t*14, tilt = t*9;
  c.save(); c.translate(P.x, P.y); c.scale(P.s, P.s);
  c.beginPath(); c.arc(0, 0, 13, 0, 7); c.clip();
  let g = c.createRadialGradient(-4, -5, 1, 0, 0, 14); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d3dae4'); c.fillStyle = g; c.fillRect(-14, -14, 28, 28);
  for (let i = 0; i < 5; i++) {                      // painéis azuis que "giram" (pseudo-3D: posição e achatamento variam com o giro)
    const a = i*1.2566 + spin, dx = Math.cos(a), dy = Math.sin(a)*Math.cos(tilt), depth = Math.sin(a)*Math.sin(tilt);
    if (depth < -.2) continue; c.save(); c.translate(dx*8.2, dy*8.2); c.rotate(a); c.scale(1, .55 + .45*Math.abs(Math.cos(tilt)));
    c.fillStyle = '#1d4fa6'; c.beginPath(); c.moveTo(-4.8, -3.4); c.quadraticCurveTo(0, -6.8, 4.8, -3.4); c.lineTo(3.4, 3.8); c.quadraticCurveTo(0, 5.8, -3.4, 3.8); c.closePath(); c.fill();
    c.strokeStyle = '#19a35a'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(-3.8, 4.6); c.quadraticCurveTo(0, 7, 3.8, 4.6); c.stroke(); c.restore();
  }
  c.strokeStyle = 'rgba(40,60,90,.35)'; c.lineWidth = .8; c.beginPath(); c.arc(0, 0, 8.2, spin, spin + 2.2); c.stroke();          // costura
  g = c.createRadialGradient(5, 5, 4, 0, 0, 14); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,10,30,.38)'); c.fillStyle = g; c.fillRect(-14, -14, 28, 28);   // volume
  c.restore();
}

// ATLETA 3D procedural (malhas, não cápsulas): torso cilíndrico com a camisa MAPEADA ao redor (nome/número curvam com o corpo),
// membros afilados com sombreamento, shorts/meias/chuteiras, cabeça elipsoidal com rosto 3D e cabelos com volume. Cada atleta tem aparência própria.
// ---- malha cilíndrica (torso/shorts): triângulos com recorte de faces traseiras, textura por padrão e luz por normal ----
const LIGHT = norm([-.45, .85, .55]);
function drawTri(c, s, t, pat, col) {
  c.save(); if (pat) { const [x0, y0] = s[0], [x1, y1] = s[1], [x2, y2] = s[2], [u0, v0] = t[0], [u1, v1] = t[1], [u2, v2] = t[2], d = u0*(v1 - v2) + u1*(v2 - v0) + u2*(v0 - v1); if (Math.abs(d) < 1e-6) { c.restore(); return; }
    const a = (x0*(v1 - v2) + x1*(v2 - v0) + x2*(v0 - v1))/d, b = (y0*(v1 - v2) + y1*(v2 - v0) + y2*(v0 - v1))/d, cc = (x0*(u2 - u1) + x1*(u0 - u2) + x2*(u1 - u0))/d, dd = (y0*(u2 - u1) + y1*(u0 - u2) + y2*(u1 - u0))/d,
      e = (x0*(u1*v2 - u2*v1) + x1*(u2*v0 - u0*v2) + x2*(u0*v1 - u1*v0))/d, f = (y0*(u1*v2 - u2*v1) + y1*(u2*v0 - u0*v2) + y2*(u0*v1 - u1*v0))/d;
    c.transform(a, b, cc, dd, e, f); c.fillStyle = pat; c.beginPath(); c.moveTo(u0, v0); c.lineTo(u1, v1); c.lineTo(u2, v2); c.closePath(); c.fill(); c.stroke(); }
  else { c.fillStyle = col; c.strokeStyle = col; c.lineWidth = 1; c.beginPath(); c.moveTo(s[0][0], s[0][1]); c.lineTo(s[1][0], s[1][1]); c.lineTo(s[2][0], s[2][1]); c.closePath(); c.fill(); c.stroke(); }
  c.restore();
}
function cyl(E, o) {
  const rings = o.rx.length, seg = o.seg || 16, V = [], N = [], Q = [];
  for (let i = 0; i < rings; i++) { const c0 = lerp(o.p0, o.p1, i/(rings - 1)); V.push([]); N.push([]); Q.push([]);
    for (let k = 0; k < seg; k++) { const th = 2*Math.PI*k/seg, s = Math.sin(th), co = Math.cos(th), pos = add(c0, add(mul(o.R, o.rx[i]*s), mul(o.F, o.rz[i]*co))); V[i].push(pos); N[i].push(norm(add(mul(o.R, s/o.rx[i]), mul(o.F, co/o.rz[i])))); Q[i].push(E.proj(pos)); } }
  if (Q.some(r => r.some(q => !q))) return; const z = dot(sub(lerp(o.p0, o.p1, .5), E.pos), E.f), tex = o.tex, pos0 = E.pos;
  E.push(z, c => { if (o.tex) { c.fillStyle = o.col; c.beginPath(); for (let i = 0; i < rings - 1; i++) for (let k = 0; k < seg; k++) { const k2 = (k + 1) % seg, n = norm(add(add(N[i][k], N[i][k2]), add(N[i + 1][k], N[i + 1][k2]))); if (dot(n, sub(pos0, V[i][k])) <= 0) continue; const a = Q[i][k], b = Q[i][k2], d = Q[i + 1][k], e = Q[i + 1][k2]; c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(e[0], e[1]); c.lineTo(d[0], d[1]); c.closePath(); } c.fill(); c.strokeStyle = o.col; c.lineWidth = 1.5; c.stroke(); } const pat = tex ? (tex.__p ??= c.createPattern(tex, 'repeat')) : null, W = tex ? tex.width : 1, Hh = tex ? tex.height : 1;
    const AL = [.3, .2, .1, .035, 0], BK = [new Path2D(), new Path2D(), new Path2D(), new Path2D(), new Path2D()], HI = new Path2D(); let anyHi = false;
    for (let i = 0; i < rings - 1; i++) for (let k = 0; k < seg; k++) { const k2 = (k + 1) % seg, n = norm(add(add(N[i][k], N[i][k2]), add(N[i + 1][k], N[i + 1][k2]))), cen = V[i][k]; if (dot(n, sub(pos0, cen)) <= 0) continue;
      const lam = Math.max(0, dot(n, LIGHT)), lv = lam < .2 ? 0 : lam < .42 ? 1 : lam < .65 ? 2 : lam < .85 ? 3 : 4, u0 = (k/seg + .25)*W, u1 = (k/seg + 1/seg + .25)*W, v0 = (1 - i/(rings - 1))*Hh, v1 = (1 - (i + 1)/(rings - 1))*Hh;
      const a = Q[i][k], b = Q[i][k2], d = Q[i + 1][k], e = Q[i + 1][k2]; drawTri(c, [a, b, d], [[u0, v0], [u1, v0], [u0, v1]], pat, o.col); drawTri(c, [b, e, d], [[u1, v0], [u1, v1], [u0, v1]], pat, o.col);
      for (const P of [BK[lv]]) { P.moveTo(a[0], a[1]); P.lineTo(b[0], b[1]); P.lineTo(e[0], e[1]); P.lineTo(d[0], d[1]); P.closePath(); } if (lam > .88) { anyHi = true; HI.moveTo(a[0], a[1]); HI.lineTo(b[0], b[1]); HI.lineTo(e[0], e[1]); HI.lineTo(d[0], d[1]); HI.closePath(); } }
    BK.forEach((P, i) => { if (AL[i] > 0) { c.fillStyle = `rgba(0,0,12,${AL[i]})`; c.fill(P); } }); if (anyHi) { c.fillStyle = 'rgba(255,255,240,.08)'; c.fill(HI); } });
}
// ---- cabeça: elipsoide + orelhas + cabelo com volume + rosto 3D (só aparece quando virado para a câmera) ----
function head(E, J, F, mood, keeper) {
  const hc = J.head, q = E.proj(hc); if (!q) return; const qu = E.proj(add(hc, mul(J.hup, .1))); if (!qu) return; const k = q[3], ang = Math.atan2(qu[0] - q[0], -(qu[1] - q[1])), a = .092*F.head*k, b = .118*F.head*k;
  const cv = norm(sub(E.pos, hc)), facing = dot(J.hfwd, cv), side = dot(J.hfwd, E.r) > 0 ? 1 : -1, hr = F.hairC, st = F.style2d || F.style;
  const lm = (r, u, f2) => { const p = E.proj(add(hc, add(add(mul(J.hright, r), mul(J.hup, u)), mul(J.hfwd, f2)))); return p ? [p[0] - q[0], p[1] - q[1]] : [0, 0]; };
  const eyeL = lm(-F.eyeW, .02, .085), eyeR = lm(F.eyeW, .02, .085), noseT = lm(0, -.012, .108*F.nose), mouthP = lm(0, -.047, .09), earL = lm(-.092, 0, 0), earR = lm(.092, 0, 0);
  E.push(q[2] - .02, c => {
    c.save(); c.translate(q[0], q[1]); c.rotate(ang);                                    // referencial local da cabeça (px)
    if (st === 'afro') { c.fillStyle = shade(hr, .85); c.beginPath(); c.ellipse(side*-.1*a*(Math.abs(facing) < .3 ? 1 : 0), -b*.12, a*1.38, b*1.24, 0, 0, 7); c.fill(); }
    if (st === 'long' && facing < .1) { c.fillStyle = shade(hr, .9); c.beginPath(); c.ellipse(0, b*.55, a*1.05, b*1.0, 0, 0, 7); c.fill(); }
    if (st === 'bun') { c.fillStyle = shade(hr, .9); c.beginPath(); c.arc(0, -b*1.15, a*.5, 0, 7); c.fill(); }
    c.fillStyle = shade(F.skin, .8); [earL, earR].forEach(e => { c.beginPath(); c.ellipse(Math.cos(-ang)*e[0] - Math.sin(-ang)*e[1], Math.sin(-ang)*e[0] + Math.cos(-ang)*e[1], a*.2*F.ear, b*.24*F.ear, 0, 0, 7); c.fill(); });   // orelhas
    const g = c.createRadialGradient(-a*.35, -b*.4, a*.1, 0, 0, b*1.05); g.addColorStop(0, shade(F.skin, 1.12)); g.addColorStop(1, shade(F.skin, .74)); c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, a, b, 0, 0, 7); c.fill();               // cabeça
    c.fillStyle = shade(F.skin, .85); c.beginPath(); c.ellipse(0, b*.62, a*.78, b*.42, 0, 0, Math.PI); c.fill();                                                                                                        // maxilar
    if ((F.beard2d || F.beard) && (F.beard2d || F.beard) !== 'none' && facing > -.1) {                                 // barba/bigode (só de frente ou 3/4): contorno do maxilar na cor do cabelo, deixando a boca livre
      const bk = F.beard2d || F.beard, cw = Math.max(.35, Math.min(1, facing + .35)); c.save(); c.fillStyle = shade(hr, .85); c.globalAlpha = bk === 'stubble' ? .34 : .92;
      if (bk !== 'mustache') { c.beginPath(); c.moveTo(-a*.84*cw, b*.08); c.quadraticCurveTo(-a*.8*cw, b*.98, 0, b*(bk === 'full' ? 1.12 : 1.02)); c.quadraticCurveTo(a*.8*cw, b*.98, a*.84*cw, b*.08); c.lineTo(a*.5*cw, b*.36); c.quadraticCurveTo(0, b*.56, -a*.5*cw, b*.36); c.closePath(); c.fill(); }
      if (bk === 'mustache' || bk === 'full' || bk === 'short') { c.globalAlpha = .95; c.beginPath(); c.ellipse(0, b*.27, a*.3*cw, b*.065, 0, 0, 7); c.fill(); } c.restore(); }
    const hairG = (x0, y0, r0) => { const gg = c.createRadialGradient(x0 - a*.3, y0 - b*.4, 1, x0, y0, r0); gg.addColorStop(0, shade(hr, 1.35)); gg.addColorStop(1, shade(hr, .7)); return gg; };
    const bald = st === 'bald';
    if (facing < .18 && !bald) {                                                         // de costas / de lado: o cabelo cobre a nuca e o topo
      const sx = facing > -.25 ? -side*a*.22 : 0; c.fillStyle = hairG(0, -b*.2, b*1.2); c.beginPath(); c.ellipse(sx, -b*.12, a*(st === 'afro' ? 1.2 : 1.07), b*(st === 'buzz' ? .98 : 1.04), 0, 0, 7); c.fill(); if (st === 'buzz') { c.fillStyle = 'rgba(200,170,140,.18)'; c.fill(); }
      if (st === 'long') { c.fillRect(-a*1.02 + sx, 0, a*2.04, b*.8); } if (st === 'curly') { for (let i = 0; i < 9; i++) { const t = i/8*Math.PI + Math.PI; c.beginPath(); c.arc(Math.cos(t)*a*1.04 + sx, Math.sin(t)*b*1.0 - b*.05, a*.3, 0, 7); c.fill(); } }
    } else if (!bald) {                                                                  // de frente: franja/topo com linha do cabelo
      const low = st === 'buzz' ? -b*.62 : -b*.42; c.fillStyle = hairG(0, -b*.6, b*1.2); c.beginPath(); c.moveTo(-a*1.0, -b*.05); c.quadraticCurveTo(-a*1.1, -b*1.15, 0, -b*1.12); c.quadraticCurveTo(a*1.1, -b*1.15, a*1.0, -b*.05); c.lineTo(a*.82, low); c.quadraticCurveTo(0, low - b*.22, -a*.82, low); c.closePath(); c.fill();
      if (st === 'long') { c.fillRect(-a*1.06, -b*.2, a*.28, b*1.1); c.fillRect(a*.78, -b*.2, a*.28, b*1.1); } if (st === 'curly') { for (let i = 0; i < 9; i++) { const t = i/8*Math.PI + Math.PI; c.beginPath(); c.arc(Math.cos(t)*a*1.02, Math.sin(t)*b*1.0 - b*.1, a*.28, 0, 7); c.fill(); } }
    }
    c.restore();
    if (facing > .22) {                                                                  // ROSTO
      const t0 = Math.min(1, (facing - .22)/.3); c.globalAlpha = t0;
      c.strokeStyle = 'rgba(40,20,10,.55)'; c.lineWidth = Math.max(1, b*.07*F.brow); c.lineCap = 'round'; [[eyeL, -1], [eyeR, 1]].forEach(([e, s]) => { c.beginPath(); c.moveTo(q[0] + e[0] - s*a*.28, q[1] + e[1] - b*.2 + (mood === 'sad' ? s*b*.05 : 0)); c.lineTo(q[0] + e[0] + s*a*.28, q[1] + e[1] - b*.24 - (mood === 'sad' ? s*b*.05 : 0)); c.stroke(); });   // sobrancelhas
      [eyeL, eyeR].forEach(e => { c.fillStyle = '#f4f1ea'; c.beginPath(); c.ellipse(q[0] + e[0], q[1] + e[1], a*.2, b*.09, ang, 0, 7); c.fill(); c.fillStyle = F.eyeC; c.beginPath(); c.arc(q[0] + e[0] + side*a*.02, q[1] + e[1], Math.max(.8, b*.075), 0, 7); c.fill(); c.fillStyle = '#000'; c.beginPath(); c.arc(q[0] + e[0] + side*a*.02, q[1] + e[1], Math.max(.5, b*.038), 0, 7); c.fill(); c.strokeStyle = 'rgba(60,30,20,.6)'; c.lineWidth = 1; c.beginPath(); c.ellipse(q[0] + e[0], q[1] + e[1], a*.2, b*.09, ang, Math.PI*1.05, Math.PI*1.95); c.stroke(); });   // olhos
      c.strokeStyle = 'rgba(70,35,20,.5)'; c.lineWidth = Math.max(1, b*.05); c.beginPath(); c.moveTo(q[0] + noseT[0]*.9, q[1] + eyeL[1]*.9 + b*.05); c.lineTo(q[0] + noseT[0] - a*.04, q[1] + noseT[1]); c.stroke();                           // nariz
      c.fillStyle = shade(F.skin, .6); c.beginPath(); c.ellipse(q[0] + noseT[0], q[1] + noseT[1] + b*.03, a*.14*F.nose, b*.05, 0, 0, 7); c.fill(); c.fillStyle = shade(F.skin, 1.25); c.beginPath(); c.arc(q[0] + noseT[0] - a*.03, q[1] + noseT[1] - b*.05, b*.03, 0, 7); c.fill();
      c.strokeStyle = '#6a2b2b'; c.fillStyle = '#4a1818'; c.lineWidth = Math.max(1, b*.055); c.beginPath(); const mx = q[0] + mouthP[0], my = q[1] + mouthP[1], mw = a*.3*F.mouth;                                                  // boca
      if (mood === 'happy') { c.ellipse(mx, my, mw, b*.1, 0, 0, Math.PI); c.fill(); } else if (mood === 'sad') c.arc(mx, my + b*.12, mw*.9, Math.PI*1.15, Math.PI*1.85); else { c.moveTo(mx - mw*.8, my); c.quadraticCurveTo(mx, my + b*.04, mx + mw*.8, my); } c.stroke(); c.globalAlpha = 1;
    }
  });
}
// ---- atleta completo ----
function drawAthlete(E, J, kit, look) {
  const F = look.face || faceOf(look.nome + look.num), skin = F.skin, sleeve = kit.sleeve || kit.c1, build = F.build, ht = F.height;
  E.ground([J.pelvis[0], 0, J.pelvis[2]], .6, .3, '#000', .32, 2e3);
  ['L', 'R'].forEach(n => { const hip = J['hip' + n], kn = J['kn' + n], an = J['an' + n], toe = J['toe' + n], mid = lerp(hip, kn, .5), mid2 = lerp(hip, kn, .62), calf = lerp(kn, an, .3), cuff = lerp(kn, an, .72), heel = add(an, mul(J.fwd, -.03));
    E.limb(hip, mid2, .09*build, .094*build, kit.sh); E.limb(mid2, kn, .072*build, .062*build, skin);                         // coxa: calção que se abre + pele
    E.limb(kn, an, .066*build, .047*build, kit.c1); E.limb(lerp(kn, an, .1), lerp(kn, an, .17), .066*build, .066*build, kit.c2);   // meia com panturrilha e faixa
    E.limb(an, toe, .054, .042, F.boot); E.limb(add(an, mul(J.right, .03)), add(toe, mul(J.right, .02)), .01, .01, kit.keeper ? '#fff' : kit.c2); void cuff; void heel; });   // chuteira com detalhe lateral
  cyl(E, { p0: add(J.pelvis, [0, -.1, 0]), p1: add(J.pelvis, [0, .06, 0]), R: J.tright, F: J.tfwd, rx: [.15*build, .148*build], rz: [.1, .096], seg: 10, col: kit.sh });   // shorts
  const dn = norm(sub(J.chest, J.pelvis)), t0 = add(J.pelvis, mul(dn, .02)), t1 = add(J.chest, mul(dn, .005)), tx = shirtTex(kit, look);   // topo do tronco (gola) 1,5 cm mais alto que antes: menos pescoço à mostra
  cyl(E, { p0: t0, p1: t1, R: J.tright, F: J.tfwd, rx: [.15*build, .17*build, .195*build, .19*build, .17*build], rz: [.098, .105, .114, .11, .095], seg: 12, tex: tx, col: kit.c1 });   // tronco (camisa mapeada); o último anel afina: a bola do ombro vira a quina arredondada do tronco (antes o topo era reto e largo e os ombros sobravam acima dele)
  ['L', 'R'].forEach(n => { const s = J['sh' + n], el = J['el' + n], ha = J['ha' + n], dirH = norm(sub(ha, el));
    E.ellip(sub(s, mul(J.up, .02)), .058*build, .058*build, J.up, sleeve);                                                                                                                                                                                        // ombro: do tamanho do braço e um pouco abaixo da articulação (não sobra "bola" acima do tronco)
    E.limb(lerp(s, el, .1), lerp(s, el, .8), .06*build, .052*build, sleeve); E.limb(lerp(s, el, .78), el, .052*build, .05*build, kit.c2); E.limb(el, ha, .045, .034, kit.long ? kit.c1 : skin);   // braço
    if (kit.glove) { E.ellip(add(ha, mul(dirH, .06)), .075, .085, dirH, '#f3f3f3'); E.limb(lerp(el, ha, .78), ha, .05, .05, kit.c2); } else E.ellip(add(ha, mul(dirH, .035)), .04, .052, dirH, skin); });                    // luvas / mãos
  E.limb(sub(J.chest, mul(J.up, .02)), J.neck, .068, .062, shade(skin, .88));   // pescoço: nasce dentro do tronco e termina sob a cabeça; ~3/4 da largura da cabeça, como no athlete.glb (antes era um "palito" fino que passava da junta)
  head(E, J, F, look.mood, kit.keeper);
}

// TORCIDA: ~900 pessoas únicas (corpo, cabeça, cabelo, braços, roupa, acessórios) em degraus 3D. Poses: sentado, em pé, aplaudindo,
// braços para o alto (pulando), mãos na cabeça (decepção), bandeira. Cada pessoa reage com atraso e energia próprios. Desenho em lote, 2 níveis de detalhe.
const ROWS = 13, AISLES = [-7.5, 0, 7.5];
const SK = ['#f6d0a8', '#e8b88a', '#c68642', '#a0693a', '#7a4a2a', '#53341f'], HC = ['#15110e', '#2b1d12', '#4a3020', '#7a5230', '#c9a45c', '#a6401e', '#9aa0a6', '#e8d9b0'], NEUTRAL = ['#e9e9e9', '#1a1a1a', '#6b7280', '#2f5aa8', '#3b7a4a', '#8a2f2f'];
let csd = 12345; const crnd = () => (csd = csd*16807 % 2147483647)/2147483647;
const fans = [], byRow = Array.from({ length: ROWS }, () => []);
for (let r = 0; r < ROWS; r++) { const half = 13 + r*.9; for (let x = -half; x <= half; x += .6 + crnd()*.12) { if (AISLES.some(a => Math.abs(x - a) < .5)) continue;
  const f = { x: x + (crnd() - .5)*.2, y: .15 + r*.6, z: -4.6 - r*.85 + (crnd() - .5)*.2, r, side: x < 0 ? 0 : 1, skin: SK[crnd()*6 | 0], hs: crnd()*6 | 0, hc: HC[crnd()*8 | 0], b: .88 + crnd()*.3, h: .94 + crnd()*.14, head: .92 + crnd()*.16, pick: crnd(), base: crnd() < .55 ? 0 : crnd() < .75 ? 1 : 2, acc: crnd(), e: crnd(), p: crnd()*6.28, shirt: '#888', trim: '#fff', pants: '#222' };
  f.lod = r <= 3 ? 2 : r <= 6 ? 1 : 0; f.d = Math.abs(f.x)*.05 + r*.04 + crnd()*.25; fans.push(f); byRow[r].push(f); } }
function colorize(teams) {                      // roupas na cor do clube (mosaico em losango) + neutras; calças escuras
  fans.forEach(f => { const t = teams[f.side]; if (!t.c1) return; const p = f.pick; f.shirt = p < .5 ? t.c1 : p < .62 ? t.c2 : p < .72 ? t.c3 : NEUTRAL[(p*100 | 0) % 6]; f.trim = t.c2; f.pants = ['#1b2233', '#2a2f3a', '#3a3f4b', '#232323'][f.hs % 4]; f.team = t; const fac = 1 - f.r*.022; f.cs = shade(f.shirt, fac); f.ck = shade(f.skin, fac); f.ch = shade(f.hc, fac); f.c1 = shade(t.c1, fac); f.c2 = shade(t.c2, fac); f.ct = shade(f.trim, fac);
    const dx = Math.abs(f.x - (f.side ? 6.5 : -6.5))/4.5, dy = Math.abs(f.r - 5)/3; if (dx + dy < .45) f.shirt = t.c2; else if (dx + dy < .9) f.shirt = t.c3; else if (f.mosaic) f.mosaic = 0; f.mos = dx + dy < .9; });
}
function paint(c, X, Y, k, f, pose, now) {
  const seated = f.base === 0 && pose < 3;
  const b = f.b, h = f.h, shC = f.cs, sk = f.ck, hr = f.ch, lod = f.lod, shoY = Y - .5*h*k, hx = X, hy = shoY - .15*k, rx = .092*f.head*k, ry = .113*f.head*k;
  const up = pose === 3, hands = up ? [[-.34*b, -1.02*h + Math.sin(now*9 + f.p)*.06], [.34*b, -1.02*h + Math.sin(now*9 + f.p + 1)*.06]] : pose === 2 ? [[-.03 - Math.sin(now*10 + f.p)*.04, -.34*h], [.03 + Math.sin(now*10 + f.p)*.04, -.34*h]] : pose === 4 ? [[-.1, -.66*h], [.1, -.66*h]] : seated ? [[-.14*b, -.04*h], [.14*b, -.04*h]] : [[-.25*b, -.04*h], [.25*b, -.04*h]];
  const arm = (s, hd) => { const sx = X + s*.2*b*k, sy = Y - .45*h*k, hX = X + hd[0]*k, hY = Y + hd[1]*k; c.lineCap = 'round';
    if (lod === 2) { const ex = (sx + hX)/2 + s*.05*k, ey = (sy + hY)/2 + (up ? 0 : .06*k); c.strokeStyle = shC; c.lineWidth = .088*k; c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.stroke(); c.strokeStyle = sk; c.lineWidth = .068*k; c.beginPath(); c.moveTo(ex, ey); c.lineTo(hX, hY); c.stroke(); c.fillStyle = sk; c.beginPath(); c.arc(hX, hY, .045*k, 0, 7); c.fill(); }
    else { c.strokeStyle = up ? sk : shC; c.lineWidth = .08*k; c.beginPath(); c.moveTo(sx, sy); c.lineTo(hX, hY); c.stroke(); } };
  const front = pose >= 2, drawArms = lod > 0 || up;
  if (!front && drawArms) { arm(-1, hands[0]); arm(1, hands[1]); }
  c.fillStyle = shC; c.beginPath(); c.moveTo(X - .17*b*k, Y); c.lineTo(X - .215*b*k, Y - .43*h*k); c.quadraticCurveTo(X, Y - .58*h*k, X + .215*b*k, Y - .43*h*k); c.lineTo(X + .17*b*k, Y); c.closePath(); c.fill();
  if (lod === 2) { c.fillStyle = 'rgba(0,0,15,.2)'; c.beginPath(); c.moveTo(X + .02*k, Y); c.lineTo(X + .01*k, Y - .54*h*k); c.quadraticCurveTo(X + .12*b*k, Y - .54*h*k, X + .215*b*k, Y - .43*h*k); c.lineTo(X + .17*b*k, Y); c.closePath(); c.fill(); }
  if (lod > 0) { if (f.acc < .12) { c.fillStyle = f.ct; c.fillRect(X - .2*b*k, Y - .3*h*k, .4*b*k, .08*k); } else if (f.acc < .26 && f.team) { c.strokeStyle = f.c1; c.lineWidth = .1*k; c.beginPath(); c.moveTo(X - .17*b*k, shoY + .02*k); c.lineTo(X + .17*b*k, shoY + .02*k); c.stroke(); c.strokeStyle = f.c2; c.lineWidth = .05*k; c.beginPath(); c.moveTo(X - .08*k, shoY); c.lineTo(X - .06*k, Y - .12*h*k); c.stroke(); } }
  if (lod > 0) { c.fillStyle = sk; c.fillRect(X - .045*k, hy + ry*.7, .09*k, .1*k); }
  if (f.hs === 3) { c.fillStyle = hr; c.beginPath(); c.arc(hx, hy - ry*.15, rx*1.35, 0, 7); c.fill(); } else if ((f.hs === 2 || f.hs === 5) && lod > 0) { c.fillStyle = hr; c.beginPath(); c.ellipse(hx, hy + ry*.5, rx*1.1, ry*1.05, 0, 0, 7); c.fill(); }
  c.fillStyle = sk; c.beginPath(); c.ellipse(hx, hy, rx, ry, 0, 0, 7); c.fill();
  if (f.hs !== 4) { c.fillStyle = hr; c.beginPath(); c.ellipse(hx, hy - ry*.2, rx*1.04, ry*.92, 0, Math.PI, 0); c.fill(); }
  if (lod > 0 && f.acc > .86 && f.team) { c.fillStyle = f.c1; c.beginPath(); c.ellipse(hx, hy - ry*.3, rx*1.06, ry*.75, 0, Math.PI, 0); c.fill(); c.fillRect(hx - rx*1.5, hy - ry*.32, rx*1.5, ry*.14); }
  if (lod === 2 && rx > 2.6) { c.fillStyle = '#1b1210'; c.beginPath(); c.arc(hx - rx*.38, hy - ry*.02, Math.max(.6, rx*.1), 0, 7); c.arc(hx + rx*.38, hy - ry*.02, Math.max(.6, rx*.1), 0, 7); c.fill();
    c.strokeStyle = '#6a2b2b'; c.fillStyle = '#4a1818'; c.lineWidth = Math.max(.8, rx*.1); c.beginPath(); if (up) { c.ellipse(hx, hy + ry*.42, rx*.32, ry*.2, 0, 0, 7); c.fill(); } else if (pose === 4) c.arc(hx, hy + ry*.62, rx*.28, Math.PI*1.1, Math.PI*1.9); else { c.moveTo(hx - rx*.25, hy + ry*.45); c.lineTo(hx + rx*.25, hy + ry*.45); } c.stroke(); }
  if (front && drawArms) { arm(-1, hands[0]); arm(1, hands[1]); }
  if (lod === 2 && f.acc > .93 && f.team && pose >= 2) { const x0 = X + .34*b*k, y0 = Y - 1.0*h*k, w = Math.sin(now*5 + f.p)*.14*k; c.strokeStyle = '#ddd'; c.lineWidth = .03*k; c.beginPath(); c.moveTo(x0, y0 + .2*k); c.lineTo(x0, y0 - .85*k); c.stroke();
    c.fillStyle = f.c1; c.beginPath(); c.moveTo(x0, y0 - .85*k); c.lineTo(x0 + .8*k + w, y0 - .8*k + w*.3); c.lineTo(x0 + .8*k + w, y0 - .4*k + w*.3); c.lineTo(x0, y0 - .4*k); c.closePath(); c.fill(); c.fillStyle = f.c2; c.fillRect(x0, y0 - .62*k, .8*k + w, .1*k); }
}

// --- sprites: torcedor em repouso é pintado uma vez num canvas e depois desenhado com 1 drawImage ---
let made = 0;
const frameStart = () => { made = 0; };
const KREF = [45, 70, 110];
function sprite(f) {
  const K = KREF[f.lod], w = Math.ceil(1.1*K), h = Math.ceil(1.3*K), cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d');
  paint(c, w/2, 1.05*K, K, f, f.base, 0); return { cv, w, h, ax: w/2, ay: 1.05*K, K };
}
function clearSprites() { fans.forEach(f => { f.sp = null; }); }
function drawFan(c, E, f, now, exS, sad) {
  const m = Math.max(0, exS[f.side]*(.5 + .5*f.e) - f.d*.1), sdn = sad[f.side]*(.4 + .6*f.e), pose = m > .5 ? 3 : m > .18 ? 2 : sdn > .3 ? 4 : f.base;
  const hop = pose === 3 ? Math.abs(Math.sin(now*8 + f.p))*.22*m : 0, seated = f.base === 0 && pose < 3, q = E.proj([f.x, f.y + (seated ? .45 : .8) + hop, f.z]); if (!q) return;
  const k = q[3], X = q[0], Y = q[1]; if (X < -40 || X > 1000 || Y < -120 || Y > 600) return;
  if (pose === f.base && pose < 2 && typeof document !== 'undefined') { let sp = f.sp; if (!sp && made < 140) { sp = f.sp = sprite(f); made++; } if (sp) { const sc = k/sp.K; c.drawImage(sp.cv, X - sp.ax*sc, Y - sp.ay*sc, sp.w*sc, sp.h*sc); return; } }
  paint(c, X, Y, k, f, pose, now);
}

function ensureSprite(f) { if (!f.sp && typeof document !== 'undefined') f.sp = sprite(f); return f.sp; }   // usado pelo motor Three.js (sprites 3D)

// FRAME: descrição PURA (sem canvas, sem WebGL) do que deve aparecer em cada quadro — poses, bola e câmera.
// É a ÚNICA fonte da animação: o motor 2D/3D procedural (scene3d.js) e o futuro motor Three.js/GLB (js/three/) apenas desenham este quadro.
const TF = .7, HS = ['short', 'long', 'bald', 'afro'], KC = ['#00c853', '#ff4fd8', '#ffd23f', '#27e1ff', '#ff7a1a'];
const kcol = t => KC[(t.id + 2) % 5] === t.c1 ? KC[0] : KC[(t.id + 2) % 5];
function ballWorld(b, k) {
  if (!b || b.t <= 0) return BALL0.slice(); const T = goalToWorld(b.gx, b.gy); T[1] = Math.max(BALL_R, T[1]);
  if (b.t < TF) { const u = b.t/TF, e = 1 - (1 - u)*(1 - u); return [T[0]*e, BALL_R + (T[1] - BALL_R)*e + (.35 + .5*b.gy)*Math.sin(Math.PI*e), SPOT_Z*(1 - e)]; }   // passa EXATAMENTE pelo ponto da mira
  const d = b.t - TF, g = 4.9;
  if (b.res === 'gol') return [T[0] + (T[0]/3.66)*.25*d, Math.max(BALL_R, T[1] - g*d*d*.5), -1.6*(1 - Math.exp(-d*3.5))];
  if (b.res === 'defesa') { const sg = Math.sign(k.tx - .5) || (T[0] < 0 ? -1 : 1); return [T[0] + sg*2.6*d, Math.max(BALL_R, T[1] + 2.2*d - g*d*d), 3.2*d]; }
  if (b.res === 'trave') { const sx = -Math.sign(T[0] || 1); return [T[0] + sx*1.2*d, Math.max(BALL_R, T[1] + (b.gy > .95 ? -.5 : 2)*d - g*d*d), 4.5*d]; }
  return [T[0] + (T[0] < 0 ? -1 : 1)*1.5*d, Math.max(BALL_R, T[1] + (b.gy > 1 ? 3 : .5)*d - g*d*d), Math.max(-3.2, -9*d)];
}
function camTarget(game, b, bw, res, d) {
  if (game.fin) return { pos: [0, 2.3, 15], tgt: [0, 1.4, 4], fov: 38 };
  if (b && res && d > 0) { const T = goalToWorld(b.gx, b.gy); return { pos: [T[0]*.3 + 1.2, 2.7, 19.5], tgt: [T[0]*.5, 1.2, 0], fov: 31 }; }                // gol / defesa: aproxima do gol e da torcida
  if (b && b.t > 0) return { pos: [bw[0]*.15, 3.1, 24], tgt: [bw[0]*.5, bw[1]*.5 + .6, Math.min(1, bw[2]*.3)], fov: 25 };                                  // acompanha a bola
  if (!b && game.t < .9) { const u = sm(game.t/.9); return { pos: lerp([5, 4.2, 29], [0, 3.3, 25], u), tgt: [0, 1.0, 1], fov: 31 - 4*u }; }                    // apresentação / preparação
  return { pos: [0, 3.3, game.dec ? 23.5 : 25], tgt: [0, 1.0, 1], fov: game.dec ? 25.5 : 27 };                                                                  // mira estável
}
// Aparência individual: o atleta (js/lineups) define pele, cabelo, barba, largura e altura; o resto do rosto vem de faceOf (determinístico). Cache por jogador: o quadro é montado a cada frame.
const faceCache = new Map();
const faceFor = L => { let f = faceCache.get(L.id); if (!f) { const a = L.ap; f = { ...faceOf(L.id), skinI: a.skinI, skin: a.skinHex || SKINS[a.skinI], hairC: a.hairHex || HAIRC[a.hairI], style: a.hair, beard: a.beard, style2d: a.hair2d, beard2d: a.beard2d, build: a.build, height: a.height,
    mustache: a.mustache, sideburn: a.sideburn, hairC2: a.hairC2, beardC: a.beardC, hl: a.hl, hlAmt: a.hlAmt, tips: a.tips, grey: a.grey, band: a.band };   /* estilo/barba novos (3D) e a versão 2D */ faceCache.set(L.id, f); } return f; };
const withFace = L => L.ap ? { ...L, face: faceFor(L) } : L;
const keeperLook = (t, mood) => { const g = keeperOf(t); return g ? { ...withFace(g), mood } : { skin: t.id % 4, hair: HS[t.id % 4], nome: 'GOL', num: 1, face: faceOf('gk' + t.id), mood }; };   // goleiro do clube (nome/número/aparência próprios) ou genérico se o clube não tiver dados
const gkKit = t => ({ c1: kcol(t), c2: '#141414', c3: '#fff', pat: 'p', sh: '#1b1b1b', keeper: true, long: true, glove: true, key: 'gk' + t.id });
// Personagens do quadro: [{ role, P (pose do rig), kit, look }]. role: kicker | keeper | mate | loser
function characters(game, now, b, k, res, d, bw) {
  const [ta, tb] = GS.equipes; if (!ta || !game.m) return null;
  if (game.fin) {                                                                                   // FIM CONFIRMADO: só o vencedor comemora; o derrotado mostra decepção
    const w = GS.vencedor, A = GS.equipes[w], B = GS.equipes[1 - w], ft = game.fin.t, run = sm(ft/1.4), list = [];
    list.push({ role: 'keeper', P: { root: [0, 0, .55], yaw: 0, lean: 0, head: [-.2], hipL: [.2, .25, .5], hipR: [.2, .25, .5], armL: [2.9, .5, .2], armR: [2.9, .5, .2], lift: Math.abs(Math.sin(ft*6))*.35 }, kit: gkKit(A), look: keeperLook(A, 'happy') });
    [[-1.3, 0], [0, 1], [1.3, 2]].forEach(([x, i]) => { const pp = pickKicker(A, i + 1, i === 1 ? game.escolha[w] : null), pos = lerp([x*.3, 0, 3], [x, 0, 7.2 - Math.abs(x)*.4], run); list.push({ role: 'mate', P: cheerPose(ft, i, pos, 0), kit: { ...A, variant: w === 1 ? 'away' : 'home', sh: A.c2 }, look: withFace(pp) }); });
    list.push({ role: 'loser', P: dejectedPose(ft, [-3.6, 0, 8.5], .6), kit: { ...B, variant: w === 1 ? 'home' : 'away', sh: B.c2 }, look: withFace(pickKicker(B, 1, null)) });
    return { final: true, list };
  }
  const kt = GS.cobrador === 0 ? ta : tb, dt2 = GS.cobrador === 0 ? tb : ta, p = pickKicker(kt, GS.cobranca, game.escolha[GS.cobrador]);
  const m = !b ? (game.t < .9 ? { mode: 'walkin', t: game.t } : { mode: 'idle', t: now }) : b.t <= TF ? { mode: 'kick', tc: Math.max(KICK_T0, b.t) } : { mode: 'react', d: b.t - TF, type: res === 'gol' ? 'gol' : 'falha' };
  const kp = keeperPose(k, b, res, d, now, b && b.t > 0 ? bw : null);
  return { final: false, list: [{ role: 'kicker', P: kickerPose(m), kit: { ...kt, sh: kt.c2, variant: GS.cobrador === 1 ? 'away' : 'home' }, look: withFace(p) },
    { role: 'keeper', P: kp.P, kit: gkKit(dt2), look: keeperLook(dt2, kp.info.happy ? 'happy' : kp.info.sad ? 'sad' : 'neutral') }] };
}

// Cena 3D da partida: estádio com arquibancada TRIDIMENSIONAL logo atrás do gol, gol com rede deformável, bola com física,
// cobrador e goleiro com esqueleto articulado (FK/IK), uniformes com nome/número mapeados no tecido, câmera cinematográfica.
const DBG = { cam: null, t: { s: 0, f: 0, n: 0 } };   // câmera de depuração (testes visuais)
const E = new Engine(), SKIN = ['#f1c27d', '#c68642', '#8d5524', '#ffdbac'], HAIR = ['#1b1b1b', '#3b2a1a', '#6b4423', '#111'], BOOT = ['#14161a', '#f4f4f4', '#ff5a1f', '#2bd96b'], FANC = ['#e63946', '#f1faee', '#ffb703', '#4361ee', '#2ec4b6', '#ff6b9d', '#8d99ae', '#06d6a0'];
const lum = h => { const n = parseInt(h.slice(1), 16); return (.3*(n >> 16) + .59*(n >> 8 & 255) + .11*(n & 255))/255; };
let seed = 7; const rnd = () => (seed = seed*16807 % 2147483647)/2147483647;
let cam = { pos: [0, 3.3, 25], tgt: [0, 1.0, 1], fov: 27 }, shake = 0, last = 0, names = [{}, {}], exS = [0, 0], sad = [0, 0], heat = .25, flags = [], banners = [[], []], smoke = [], flares = [], boardCv = [];
// ---------- torcida e estádio (dados estáticos) ----------
const tufts = []; for (let i = 0; i < 520; i++) tufts.push([(rnd() - .5)*50, 0, 24 - rnd()*27]);
[['gol', e => { exS[e.equipe] = 1; sad[1 - e.equipe] = 1; shake = 1; burst(e.equipe); }], ['defesa', e => { exS[1 - e.equipe] = .7; sad[e.equipe] = .6; shake = .5; }], ['trave', () => { exS = exS.map(v => Math.max(v, .4)); shake = .8; }], ['fora', e => { sad[e.equipe] = .5; }],
 ['partida_encerrada', e => { exS[e.vencedor] = 1; sad[1 - e.vencedor] = 1; burst(e.vencedor); }]].forEach(([k, f]) => Events.on(k, f));
function burst(s) { const t = names[s]; for (let i = 0; i < 18 && smoke.length < 120; i++) smoke.push({ x: (s ? 1 : -1)*(2 + rnd()*10), y: 2 + rnd()*3, z: -6 - rnd()*5, vy: .5 + rnd()*.6, vx: (rnd() - .5)*.3, r: .5 + rnd()*.5, life: 2.8, col: rnd() < .6 ? t.c1 : t.c2 }); }
function bannerTex(t, txt) {
  if (typeof document === 'undefined') return null;                                  // (testes em Node não desenham)                          // faixa: texto legível (não deformado), cores do clube
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 84; const c = cv.getContext('2d'); c.fillStyle = t.c1; c.fillRect(0, 0, 512, 84); c.fillStyle = t.c2; c.fillRect(0, 62, 512, 22); c.fillRect(0, 0, 512, 8);
  c.fillStyle = lum(t.c1) > .55 ? '#111' : '#fff'; c.textAlign = 'center'; let fs = 44; c.font = `900 ${fs}px Arial`; while (c.measureText(txt).width > 480 && fs > 16) c.font = `900 ${--fs}px Arial`; c.fillText(txt, 256, 52); return cv;
}
function setTeams(a, b) {
  names = [a, b]; exS = [0, 0]; sad = [0, 0]; heat = .25; smoke.length = 0;
  colorize(names); clearSprites();
  banners = [a, b].map((t, s) => [`VAMOS, ${t.nome.toUpperCase()}!`, 'ATÉ O FIM!', 'NOSSA PAIXÃO!', 'JAMAIS ABANDONAREMOS!'].sort(() => rnd() - .5).slice(0, 3).map((txt, i) => ({ tex: bannerTex(t, txt), x: (s ? 1 : -1)*[10.2, 4.4, 8.6][i], r: [1, 4, 7][i], w: [4.4, 3.8, 4.2][i] })));
  flags = []; [0, 1].forEach(s => { for (let i = 0; i < 7; i++) flags.push({ s, x: (s ? 1 : -1)*(1.5 + rnd()*11), r: 1 + (rnd()*8 | 0), p: rnd()*6, t: names[s] }); });
  flares = []; [0, 1].forEach(s => [0, 1, 2, 3].forEach(i => flares.push({ s, x: (s ? 1 : -1)*(2.5 + i*3 + rnd()*1.5), y: 1.6 + (i % 2)*1.4, z: -5.5 - (i % 2)*1.6, ph: rnd()*6 })));
}
// ---------- personagem: malha procedural em js/athlete.js ----------
const human = (J, kit, look) => DBG.noAth ? 0 : drawAthlete(E, J, kit, { ...look, face: look.face || faceOf((look.nome || '') + (look.num ?? ''), { hair: look.hair }) });
// ---------- bola ----------
// ---------- gol e rede ----------
function goal(c, b, res, d) {
  const w = GOAL_W/2, bw = 3.3, bz = -2, bh = 2, amp = res === 'gol' && d > 0 ? Math.max(0, 1 - d/.8)*Math.cos(d*22) : 0, T = b ? goalToWorld(b.gx, b.gy) : [0, 1, 0];
  const bp = (u, v) => { const x = -bw + 2*bw*u, y = bh*v, dd = Math.exp(-(((x - T[0])/1.3)**2 + ((y - T[1])/.9)**2))*amp; return [x + (x - T[0])*dd*.25, y - dd*.25, bz - dd*.55]; };
  const net = (z, fn) => { E.push(z, cc => { cc.strokeStyle = 'rgba(235,240,245,.5)'; cc.lineWidth = 1; cc.beginPath(); fn(cc); cc.stroke(); }); };
  net(E.proj([0, 1, bz]) ? E.proj([0, 1, bz])[2] + .2 : 1, cc => { for (let i = 0; i <= 26; i++) for (let j = 0; j <= 10; j++) { const q = E.proj(bp(i/26, j/10)); if (!q) continue; j ? cc.lineTo(q[0], q[1]) : cc.moveTo(q[0], q[1]); } for (let j = 0; j <= 10; j++) for (let i = 0; i <= 26; i++) { const q = E.proj(bp(i/26, j/10)); if (!q) continue; i ? cc.lineTo(q[0], q[1]) : cc.moveTo(q[0], q[1]); } });
  const side = s => { const zq = E.proj([s*w, 1, -1]); net(zq ? zq[2] : 1, cc => { for (let k = 0; k <= 8; k++) { const a = [s*w, 2.44*k/8*(1), 0], bb = [s*bw, bh*k/8, bz], p = E.proj(a), q = E.proj(bb); if (p && q) { cc.moveTo(p[0], p[1]); cc.lineTo(q[0], q[1]); } } for (let k = 0; k <= 6; k++) { const a = [s*(w - (w - bw)*k/6), 0 + (2.44 + (bh - 2.44)*k/6)*0, -2*k/6], p0 = E.proj([s*(w - (w - bw)*k/6), 0, -2*k/6]), p1 = E.proj([s*(w - (w - bw)*k/6), 2.44 + (bh - 2.44)*k/6, -2*k/6]); void a; if (p0 && p1) { cc.moveTo(p0[0], p0[1]); cc.lineTo(p1[0], p1[1]); } } }); };
  side(-1); side(1);
  const tq = E.proj([0, 2.2, -1]); net(tq ? tq[2] : 1, cc => { for (let k = 0; k <= 14; k++) { const x = -w + 2*w*k/14, xb = -bw + 2*bw*k/14, p = E.proj([x, 2.44, 0]), q = E.proj([xb, bh, bz]); if (p && q) { cc.moveTo(p[0], p[1]); cc.lineTo(q[0], q[1]); } } });
  const white = '#f5f7fa', gray = '#9aa4ad';
  E.capsule([-w, 0, 0], [-w, GOAL_H, 0], .065, white); E.capsule([w, 0, 0], [w, GOAL_H, 0], .065, white); E.capsule([-w, GOAL_H, 0], [w, GOAL_H, 0], .065, white);
  E.capsule([-bw, 0, bz], [-bw, bh, bz], .03, gray); E.capsule([bw, 0, bz], [bw, bh, bz], .03, gray); E.capsule([-bw, bh, bz], [bw, bh, bz], .03, gray);
  [-1, 1].forEach(s => { E.capsule([s*w, GOAL_H, 0], [s*bw, bh, bz], .03, gray); E.capsule([s*w, 0, 0], [s*bw, 0, bz], .03, gray); });
  [-1, 1].forEach(s => E.quad([[s*w - .04, 0, .01], [s*w + .04, 0, .01], [s*w + 1.1, 0, .5], [s*w + 1.0, 0, .5]], 'rgba(0,0,0,.3)', 99));   // sombra dos postes no gramado
}
// ---------- chão, arquibancada, placas ----------
const poly = (c, pts) => { const q = pts.map(p => E.proj(p)); if (q.some(v => !v)) return false; c.beginPath(); c.moveTo(q[0][0], q[0][1]); for (let i = 1; i < q.length; i++) c.lineTo(q[i][0], q[i][1]); c.closePath(); return true; };
function polyC(c, pts) {                                // polígono com recorte no plano próximo da câmera (Sutherland–Hodgman)
  const cs = pts.map(p => { const d = sub(p, E.pos); return [dot(d, E.r), dot(d, E.u), dot(d, E.f)]; }), out = [], N = .3;
  for (let i = 0; i < cs.length; i++) { const a = cs[i], b = cs[(i + 1) % cs.length], ai = a[2] >= N, bi = b[2] >= N; if (ai) out.push(a); if (ai !== bi) { const t = (N - a[2])/(b[2] - a[2]); out.push([a[0] + (b[0] - a[0])*t, a[1] + (b[1] - a[1])*t, N]); } }
  if (out.length < 3) return false; c.beginPath(); out.forEach((q, i) => { const k = E.focal/q[2], x = W/2 + q[0]*k, y = H/2 - q[1]*k; i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.closePath(); return true;
}
const line = (c, pts) => { c.beginPath(); let st = false; pts.forEach(p => { const q = E.proj(p); if (!q) return; st ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); st = true; }); c.stroke(); };
function texNow(c, img, TL, TR, BL) { const a = E.proj(TL), b = E.proj(TR), d = E.proj(BL); if (!a || !b || !d) return; c.save(); c.transform((b[0] - a[0])/img.width, (b[1] - a[1])/img.width, (d[0] - a[0])/img.height, (d[1] - a[1])/img.height, a[0], a[1]); c.drawImage(img, 0, 0); c.restore(); }
function drawBackground(c, now) {
  let g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#04070f'); g.addColorStop(.5, '#0c1730'); g.addColorStop(1, '#101c34'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const zm = Math.min(24, E.pos[2] - .3);
  polyC(c, [[-60, 0, -3.6], [60, 0, -3.6], [60, 0, 40], [-60, 0, 40]]); c.fillStyle = '#237a38'; c.fill();                                       // gramado
  for (let i = 0; i < 18; i++) { const zz = 40 - i*2.6, z0 = zz, z1 = zz - 2.6; if (zz < -3.6) break; if (i % 2) continue; if (polyC(c, [[-60, 0, Math.max(z1, -3.6)], [60, 0, Math.max(z1, -3.6)], [60, 0, z0], [-60, 0, z0]])) { c.fillStyle = '#2d8f43'; c.fill(); } }   // faixas de corte em perspectiva real
  c.lineWidth = 1; tufts.forEach(t => { if (t[2] > zm) return; const a = E.proj(t), b = E.proj([t[0] + .03, .1, t[2]]); if (!a || !b) return; c.strokeStyle = (t[0]*7 | 0) % 2 ? 'rgba(190,255,150,.22)' : 'rgba(0,40,0,.3)'; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); });
  g = c.createRadialGradient(480, 330, 60, 480, 330, 620); g.addColorStop(0, 'rgba(255,255,210,.16)'); g.addColorStop(1, 'rgba(0,10,0,.28)'); c.fillStyle = g; c.fillRect(0, 250, W, 290);                // luz dos refletores
  c.strokeStyle = 'rgba(255,255,255,.93)'; c.lineWidth = 2.4; c.lineCap = 'round';
  line(c, [[-34, .01, 0], [34, .01, 0]]); line(c, [[-9.16, .01, 0], [-9.16, .01, 5.5], [9.16, .01, 5.5], [9.16, .01, 0]]); line(c, [[-20.16, .01, 0], [-20.16, .01, 16.5], [20.16, .01, 16.5], [20.16, .01, 0]]);
  const arc = []; for (let a = -.93; a <= .93; a += .06) arc.push([Math.sin(a)*9.15, .01, SPOT_Z + Math.cos(a)*9.15]); line(c, arc);
  { const q = E.proj([0, .01, SPOT_Z]), qx = E.proj([.11, .01, SPOT_Z]), qz = E.proj([0, .01, SPOT_Z - .11]); if (q && qx && qz) { c.fillStyle = '#fff'; c.beginPath(); c.ellipse(q[0], q[1], Math.abs(qx[0] - q[0]), Math.abs(qz[1] - q[1]), 0, 0, 7); c.fill(); } }   // marca do pênalti (achatada no chão)
  // arquibancada 3D: degraus, torcedores (com profundidade real), faixas, bandeiras, fumaça
  poly(c, [[-45, 0, -22], [45, 0, -22], [45, 20, -22], [-45, 20, -22]]); c.fillStyle = '#0a0f1d'; c.fill();
  for (let r = ROWS - 1; r >= 0; r--) { const y = .15 + r*.6, z = -4.6 - r*.85, half = 14 + r*.9;
    if (poly(c, [[-half, y - .6, z + .85], [half, y - .6, z + .85], [half, y, z + .85], [-half, y, z + .85]])) { c.fillStyle = r % 2 ? '#1c2438' : '#222b42'; c.fill(); }
    if (poly(c, [[-half, y, z + .85], [half, y, z + .85], [half, y, z], [-half, y, z]])) { c.fillStyle = '#2a3452'; c.fill(); }
    if (!DBG.noCrowd) byRow[r].forEach(f => drawFan(c, E, f, now, exS, sad));
    AISLES.forEach(ax => { if (poly(c, [[ax - .45, y - .55, z + .85], [ax + .45, y - .55, z + .85], [ax + .45, y, z + .4], [ax - .45, y, z + .4]])) { c.fillStyle = r % 2 ? '#3a4560' : '#434f6c'; c.fill(); } });
    banners.forEach((bs, s) => bs.forEach(bn => { if (bn.r !== r) return; const x = bn.x, y0 = y + .85; texNow(c, bn.tex, [x - bn.w/2, y0 + .75, z + .5], [x + bn.w/2, y0 + .75, z + .5], [x - bn.w/2, y0, z + .5]); void s; }));
    flags.forEach(fl => { if (fl.r !== r) return; const x = fl.x, y0 = y + 1.2, w = Math.sin(now*4 + fl.p)*.3; const p0 = E.proj([x, y, z]), p1 = E.proj([x, y0 + .9, z]); if (!p0 || !p1) return; c.strokeStyle = '#ddd'; c.lineWidth = .04*p0[3]; c.beginPath(); c.moveTo(p0[0], p0[1]); c.lineTo(p1[0], p1[1]); c.stroke();
      if (poly(c, [[x, y0 + .9, z], [x + 1.1 + w, y0 + .85 + w*.2, z], [x + 1.1 + w, y0 + .35 + w*.2, z], [x, y0 + .4, z]])) { c.fillStyle = fl.t.c1; c.fill(); } if (poly(c, [[x, y0 + .65, z], [x + 1.1 + w, y0 + .6 + w*.2, z], [x + 1.1 + w, y0 + .4 + w*.2, z], [x, y0 + .4, z]])) { c.fillStyle = fl.t.c2; c.fill(); } });
  }
  // placas de publicidade (plano 3D logo atrás da linha de fundo)
  for (let k = 0; k < 6; k++) { const r = Ads.current('main', now, k); let cv = boardCv[k]; if (!cv) { cv = boardCv[k] = document.createElement('canvas'); cv.width = 384; cv.height = 64; } const x = cv.getContext('2d'); x.fillStyle = r ? r.ad.backgroundColor : '#0d1b2a'; x.fillRect(0, 0, 384, 64); x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(0, 0, 384, 5);
    if (r) { x.globalAlpha = r.alpha; if (r.image) { const q = Math.min(370/r.image.naturalWidth, 54/r.image.naturalHeight); x.drawImage(r.image, 192 - r.image.naturalWidth*q/2, 5, r.image.naturalWidth*q, r.image.naturalHeight*q); } else { x.fillStyle = r.ad.textColor; x.textAlign = 'center'; let fs = 26; x.font = `800 ${fs}px Arial`; const tx = r.ad.sponsor.toUpperCase(); while (x.measureText(tx).width > 360 && fs > 12) x.font = `800 ${--fs}px Arial`; x.fillText(tx, 192, 41); } x.globalAlpha = 1; }
    texNow(c, cv, [-18 + k*6, 1, -3.6], [-12 + k*6, 1, -3.6], [-18 + k*6, .1, -3.6]); }
}
let bgLayer = null, bgKey = '', bgT = -9, lastKey = '';
function drawStadium(c, now, dt, game) {               // fundo estático em camada de cache: refeita ao mover a câmera, ao reagir a torcida ou a cada 0,12 s
  const calm = exS[0] + exS[1] + sad[0] + sad[1] < .02, key = [E.pos[0], E.pos[1], E.pos[2], E.tgt[0], E.tgt[1], E.tgt[2], E.fov, c.canvas.width].map(v => v.toFixed(3)).join(), stable = key === lastKey; lastKey = key;
  if (calm && stable && !DBG.noCache && typeof document !== 'undefined') {
    if (!bgLayer || bgLayer.width !== c.canvas.width || bgLayer.height !== c.canvas.height) { bgLayer = document.createElement('canvas'); bgLayer.width = c.canvas.width; bgLayer.height = c.canvas.height; bgKey = ''; }
    if (key !== bgKey || now - bgT > .12) { const lc = bgLayer.getContext('2d'), k0 = bgLayer.width/W; lc.setTransform(k0, 0, 0, k0, 0, 0); lc.clearRect(0, 0, W, H); drawBackground(lc, now); bgKey = key; bgT = now; }
    c.drawImage(bgLayer, 0, 0, W, H);
  } else { bgKey = ''; drawBackground(c, now); }
  drawEffects(c, now, dt, game);
}
function drawEffects(c, now, dt, game) {
  // fumaça colorida e sinalizadores (apenas efeitos visuais, só na arquibancada)
  heat += ((game.fin ? 1 : game.dec ? .6 : .25) - heat)*(1 - Math.exp(-2*dt));
  flares.forEach(f => { const q = E.proj([f.x, f.y, f.z]); if (!q) return; const pulse = 1 + .25*Math.sin(now*9 + f.ph), rad = .5*q[3]*pulse, t = names[f.s]; if (!t.c1) return; const gr = c.createRadialGradient(q[0], q[1], 0, q[0], q[1], rad); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.3, t.c1 + 'cc'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(q[0] - rad, q[1] - rad, rad*2, rad*2);
    if (smoke.length < 120 && rnd() < heat*dt*4) smoke.push({ x: f.x, y: f.y, z: f.z, vy: .5 + rnd()*.4, vx: (rnd() - .5)*.3, r: .35 + rnd()*.3, life: 2.8, col: rnd() < .6 ? t.c1 : t.c2 }); });
  for (let i = smoke.length - 1; i >= 0; i--) { const p = smoke[i]; p.life -= dt; if (p.life <= 0) { smoke.splice(i, 1); continue; } p.y += p.vy*dt; p.x += p.vx*dt; p.r += .3*dt; const q = E.proj([p.x, p.y, p.z]); if (!q) continue; c.globalAlpha = Math.max(0, p.life/2.8)*.22; c.fillStyle = p.col; c.beginPath(); c.arc(q[0], q[1], p.r*q[3], 0, 7); c.fill(); } c.globalAlpha = 1;
  [[-16, 13, -12], [16, 13, -12], [-9, 15, -16], [9, 15, -16]].forEach(p => { const q = E.proj(p); if (!q) return; const rad = 70, gr = c.createRadialGradient(q[0], q[1], 0, q[0], q[1], rad); gr.addColorStop(0, 'rgba(255,255,235,.95)'); gr.addColorStop(.25, 'rgba(255,250,200,.35)'); gr.addColorStop(1, 'rgba(255,250,200,0)'); c.fillStyle = gr; c.fillRect(q[0] - rad, q[1] - rad, rad*2, rad*2); });   // refletores
}
// ---------- câmera cinematográfica ----------
// ---------- cena ----------
function drawScene(c, game) {
  const now = performance.now()/1000, dt = Math.min(.05, now - last || .016); last = now; exS = exS.map(v => Math.max(0, v - dt*.5)); sad = sad.map(v => Math.max(0, v - dt*.4));
  const b = game.fin ? null : game.ball, k = game.keeper, res = b?.res, d = b ? b.t - TF : 0, bw = ballWorld(b, k), T = camTarget(game, b, bw, res, d), f = 1 - Math.exp(-3*dt);
  if (DBG.cam) Object.assign(cam, { pos: DBG.cam.pos.slice(), tgt: DBG.cam.tgt.slice(), fov: DBG.cam.fov }); else {
  cam.pos = lerp(cam.pos, T.pos, f); cam.tgt = lerp(cam.tgt, T.tgt, f); cam.fov += (T.fov - cam.fov)*f; } shake = Math.max(0, shake - dt*2.2);
  const k0 = c.canvas.width/W; c.setTransform(k0, 0, 0, k0, 0, 0); E.pos = shake ? add(cam.pos, [(rnd() - .5)*shake*.12, (rnd() - .5)*shake*.12, 0]) : cam.pos; E.tgt = cam.tgt; E.fov = cam.fov; E.begin(c);
  frameStart(); const pt0 = performance.now(); drawStadium(c, now, dt, game); DBG.t.s += performance.now() - pt0;
  const fr = characters(game, now, b, k, res, d, bw);
  goal(c, fr ? b : null, fr ? res : null, fr ? d : 0);
  if (fr) {
    fr.list.forEach(ch => human(humanJoints(ch.P), ch.kit, ch.look));
    if (!fr.final) {
      const q = E.proj(bw); if (q) { const rad = BALL_R*1.35*q[3], gq = E.proj([bw[0], 0, bw[2]]); E.push(q[2], cc => drawBall(cc, { x: q[0], y: q[1], s: rad/13, gy: gq ? gq[1] : q[1] }, b)); }
      if (res === 'trave' && d > 0 && d < .25) E.sphere(bw, .35, 'rgba(255,255,255,.6)', false);
    }
  }
  const pt1 = performance.now(); E.flush(); DBG.t.f += performance.now() - pt1; DBG.t.n++;
  if (game.m && !game.fin && game.hum() && !b && (GS.estado === 'MIRANDO' || GS.estado === 'AGUARDANDO_COBRANCA')) drawAim(c, game.aim, GS.estado === 'MIRANDO');
  hud(c, game, res, b);
}
function drawAim(c, aim, hold) {                       // linha no plano do gol que oscila; marcador de altura sobe ao segurar; anel = ponto final
  const x = (aim.x - .5)*GOAL_W, y = aim.y*GOAL_H, a = E.proj([x, 0, .05]), t = E.proj([x, GOAL_H, .05]), q = E.proj([x, y, .05]); if (!a || !t || !q) return; const k = q[3];
  c.save(); c.lineCap = 'round'; c.strokeStyle = 'rgba(255,230,109,.65)'; c.lineWidth = 2.5; c.shadowColor = '#ffe66d'; c.shadowBlur = 8; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(t[0], t[1]); c.stroke(); c.shadowBlur = 0;
  c.fillStyle = '#ffe66d'; c.beginPath(); c.moveTo(t[0] - 7, t[1] - 16); c.lineTo(t[0] + 7, t[1] - 16); c.lineTo(t[0], t[1] - 6); c.fill();
  c.strokeStyle = hold ? '#ff2d55' : 'rgba(255,255,255,.9)'; c.lineWidth = 2.5; c.beginPath(); c.arc(q[0], q[1], (hold ? .3 : .22)*k, 0, 7); c.stroke();
  if (hold) { c.fillStyle = '#ff2d55'; c.beginPath(); c.moveTo(q[0], q[1] - 5); c.lineTo(q[0] + 5, q[1]); c.lineTo(q[0], q[1] + 5); c.lineTo(q[0] - 5, q[1]); c.fill(); }
  const bx = E.proj([GOAL_W/2 + .9, 0, 0]), bt = E.proj([GOAL_W/2 + .9, GOAL_H, 0]); if (bx && bt) { const f = (aim.y - AIM_LIM.ymin)/(AIM_LIM.ymax - AIM_LIM.ymin), hh = bx[1] - bt[1]; c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(bx[0], bt[1], 9, hh); c.fillStyle = hold ? '#ff2d55' : '#ffe66d'; c.fillRect(bx[0], bx[1] - hh*f, 9, hh*f); c.strokeStyle = '#fff'; c.lineWidth = 1; c.strokeRect(bx[0], bt[1], 9, hh); }
  c.restore();
}

Renderer.set({ name: 'procedural', drawScene, setTeams });   // registra este motor como o padrão

return {drawScene,setTeams,DBG};})();
// Mixer (skills audio-design/game-audio): barramentos efeitos + torcida → master → limitador. Volumes em dB, mute no master, iniciado após interação.
let ctx, master, fx, cr, amb;
const IMPACT = new Set(['trave', 'travessao', 'defesa', 'rede', 'gol']);
function init() {
  if (ctx) return true;
  try { ctx = new AudioContext(); const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -10; lim.ratio.value = 10; lim.attack.value = .005; lim.release.value = .25;
    master = ctx.createGain(); fx = ctx.createGain(); cr = ctx.createGain(); fx.connect(master); cr.connect(master); master.connect(lim); lim.connect(ctx.destination); return true; } catch { return false; }
}
function vols() { if (ctx.state === 'suspended') ctx.resume(); master.gain.value = cfg.sound ? 1 : 0; fx.gain.value = taper(cfg.vol); cr.gain.value = taper(cfg.volCrowd); }
const lvl = () => amb ? amb.cur*.9 + .1 : 1;
function duck(g, dur) { if (!amb) return; const a = amb.out.gain, t = ctx.currentTime; a.cancelScheduledValues(t); a.setValueAtTime(lvl()*g, t); a.linearRampToValueAtTime(lvl(), t + dur); }   // impacto abafa a torcida por um instante
function sfx(n, delay = 0) {                                    // chamado pela lógica depois do evento confirmado
  if (!cfg.sound || !init()) return; vols();
  if (SFX_FILES[n]) { try { const a = new Audio(SFX_FILES[n]); a.volume = taper(n === 'roar' || n === 'groan' || n === 'expect' || n === 'roarBig' ? cfg.volCrowd : cfg.vol); setTimeout(() => a.play().catch(() => {}), delay*1000); } catch {} return; }
  VAR.pitch = .94 + Math.random()*.12;                                 // variação para não soar mecânico
  RECIPES[n]?.(ctx, ['roar', 'roarBig', 'groan', 'expect'].includes(n) ? cr : fx, ctx.currentTime + delay);
  if (IMPACT.has(n)) duck(.55, .4);
}
const crowd = n => sfx(n);
function ambient(on) {                                          // murmúrio contínuo: 3 camadas de ruído com oscilação lenta própria
  if (!cfg.sound || !init()) return; vols();
  if (on && !amb) {
    const out = ctx.createGain(); out.gain.value = .55; out.connect(cr); const layers = [[300, .5, .07, .13], [900, .6, .05, .31], [1800, .8, .022, .07]].map(([f, q, g, hz]) => {
      const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), gn = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain(); const n = ctx.sampleRate*3, b = ctx.createBuffer(1, n, ctx.sampleRate), a = b.getChannelData(0); for (let i = 0; i < n; i++) a[i] = Math.random()*2 - 1;
      s.buffer = b; s.loop = true; fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = q; gn.gain.value = g; lfo.frequency.value = hz; lg.gain.value = g*.6; lfo.connect(lg).connect(gn.gain); s.connect(fl).connect(gn).connect(out); s.start(); lfo.start(); return { s, lfo }; });
    amb = { layers, out, cur: .45 };
  } else if (!on && amb) { amb.layers.forEach(l => { try { l.s.stop(); l.lfo.stop(); } catch {} }); amb = null; }
}
function level(v) { if (!amb) return; amb.cur = v; amb.out.gain.setTargetAtTime(lvl(), ctx.currentTime, .4); }   // intensidade da torcida (expectativa → explosão)

// Núcleo da disputa: máquina de estados, física da bola, goleiro, regras e renderização Canvas.
const cfg = { hs: 0.9, vs: 0.6, diff: 'normal', sound: true, vol: 0.5, volCrowd: 0.5 };
// Dificuldade: tempo de reação, alcance do braço, erro de leitura, deslocamento máximo do mergulho
const DIFF = { easy:{react:.45,reach:.09,err:.22,dive:.3,vr:.3}, normal:{react:.3,reach:.12,err:.13,dive:.36,vr:.36}, hard:{react:.2,reach:.15,err:.07,dive:.42,vr:.42} };
const T_FLIGHT = .7, T_DIVE = .6, W = 960, H = 540;
const G = { l:300, r:660, t:150, b:290 }, START = { x:480, y:470 };
const gpt = (gx, gy) => ({ x: G.l + gx*(G.r-G.l), y: G.b - gy*(G.b-G.t) });  // coord. do gol → tela

const Game = {
  aim: new Aim(), m: null, ball: null, t: 0, wait: 0, cb: null, keeperKey: null,
  init(canvas) {
    this.cv = canvas; this.c = canvas.getContext('2d');
    canvas.addEventListener('pointerdown', e => { e.preventDefault(); this.down(e); });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('dragstart', e => e.preventDefault());
    window.addEventListener('pointerup', () => this.up());          // soltar dentro OU fora do canvas
    window.addEventListener('pointercancel', () => this.cancel());
    window.addEventListener('blur', () => this.cancel());
    window.addEventListener('keydown', e => { const k = {ArrowLeft:[.15,.4],ArrowRight:[.85,.4],ArrowUp:[.5,.85],ArrowDown:[.5,.15]}[e.key]; if (k) { e.preventDefault(); this.keeperChoose(k[0], k[1]); } });
    let last = performance.now();
    const STEP = 1/120, loop = n => { const dt = Math.min(.05, (n-last)/1000); last = n; this.acc = (this.acc || 0) + dt; let i = 0; while (this.acc >= STEP && i++ < 12) { this.update(STEP); this.acc -= STEP; }   // passo FIXO (skill physics-tuning): mira e bola não dependem do FPS
      this.draw(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  },
  start(a, b, onEnd, two = false, escolha = [null, null]) {
    this.two = two; this.escolha = escolha;                       // a = jogador, b = adversário
    this.cb = onEnd; this.paused = false; this.fin = null; Renderer.setTeams?.(a, b); ambient(true);
    GS.equipes = [a, b]; GS.placar = [0,0]; GS.cobranca = 1; GS.cobrancasRealizadas = 0; GS.vencedor = null; GS.ultimaCobranca = null;
    this.m = { taken:[0,0], marks:[[],[]], fim:false };
    Events.emit('partida_iniciada', { equipes: GS.equipes });
    this.setTurn(0);
  },
  hum(k = GS.cobrador) { return this.two || k === 0; },     // este chute é de um humano? (no modo 2 pessoas, sempre)
  stop() { ambient(false); this.fin = null; this.m = null; this.ball = null; GS.estado = 'MENU'; },
  restart() { const [a, b] = GS.equipes, cb = this.cb, t = this.two, e = this.escolha; if (!a) return; Events.emit('partida_reiniciada'); this.start(a, b, cb, t, e); },
  setTurn(k) {
    GS.cobrador = k; this.ball = null; this.aim.reset(); if (this.hum(k)) this.aim.run(); this.keeperKey = null; this.t = 0; this.keeper = { x:.5, tx:.5, t0:0 };   // a linha de mira já oscila durante a espera
    this.wait = this.hum(k) ? 0 : 1.1; this.dec = this.m.taken[k] >= 4; if (this.dec) sfx('decisiva'); level(this.dec ? .85 : .45);     // cobrança decisiva: 5ª ou morte súbita                       // adversário cobra após breve pausa
    GS.estado = this.hum(k) ? 'AGUARDANDO_COBRANCA' : 'DEFESA_DO_GOLEIRO';
    Events.emit('cobranca_mudou', { cobranca: GS.cobranca, cobrador: k });
  },
  down(e) {
    if (this.paused || !this.m || this.t < .9) return;     // espera o cobrador chegar à bola
    if (GS.estado === 'AGUARDANDO_COBRANCA') { this.aim.start(); GS.estado = 'MIRANDO'; level(.75); crowd('expect'); }   // só inicia aqui
    else if (GS.estado === 'DEFESA_DO_GOLEIRO' && this.ball && e) {          // toque/clique no campo escolhe o lado e a altura do mergulho
      const r = this.cv.getBoundingClientRect(), nx = (e.clientX - r.left)/r.width, ny = (e.clientY - r.top)/r.height; this.keeperChoose(nx < .38 ? .15 : nx > .62 ? .85 : .5, ny < .3 ? .85 : ny > .6 ? .15 : .4);
    }
  },
  up() {
    if (GS.estado !== 'MIRANDO') return;                  // ignora soltar fora de contexto → sem disparo duplo
    const p = this.aim.release(); this.launch(p.gx, p.gy);
  },
  cancel() { if (GS.estado === 'MIRANDO') { this.aim.reset(); this.aim.run(); GS.estado = 'AGUARDANDO_COBRANCA'; } },  // perda de foco: cancela mira
  launch(gx, gy) {
    GS.estado = this.hum() ? 'CHUTANDO' : 'DEFESA_DO_GOLEIRO';
    this.ball = { gx, gy, t: -.55, res: null, som: false };     // t<0: corrida de aproximação; a bola só sai no CONTATO (t=0); a corrida dura 0,55 s
    this.rating = pickKicker(GS.equipes[GS.cobrador], GS.cobranca, this.escolha[GS.cobrador]).rating;
    this.keeper.t0 = null; level(1); Events.emit('chute', { equipe: GS.cobrador });
    if (this.hum()) {                              // goleiro CPU: decide só após o tempo de reação, vendo a bola
      const d = DIFF[cfg.diff]; this.keeper.est = null; this.keeper.d = d;
    }
  },
  keeperChoose(x, th = .4) {                                       // goleiro do jogador: decisão nos primeiros 0,3 s do voo
    const b = this.ball; if (this.hum() || !b || b.t > .3 || this.keeper.t0 != null) return;
    this.keeper.tx = x; this.keeper.th = th; this.keeper.t0 = b.t;
  },
  resolve() {
    const b = this.ball, k = this.keeper; let r;
    const out = b.gx < 0 || b.gx > 1 || b.gy > 1, post = !out && (b.gx < .035 || b.gx > .965 || b.gy > .955);
    if (out) r = 'fora'; else if (post) r = 'trave';
    else {
      const kx = .5 + (k.tx - .5) * Math.min(1, k.t0 == null ? 0 : (T_FLIGHT - k.t0) / T_DIVE);
      const reach = (this.hum() ? DIFF[cfg.diff].reach : .12) * (b.gy > .8 ? .6 : 1) * (1 - ((this.rating || 75) - 75) / 500);   // craque dificulta um pouco
      const ky = .3 + ((k.th ?? .3) - .3) * Math.min(1, k.t0 == null ? 0 : (T_FLIGHT - k.t0) / T_DIVE);   // altura alcançada pelo goleiro
      r = Math.abs(kx - b.gx) < reach && Math.abs(ky - b.gy) < (this.hum() ? DIFF[cfg.diff].vr : .36) ? 'defesa' : 'gol';
    }
    b.res = r; GS.estado = 'RESOLVENDO_COBRANCA';
    const q = GS.cobrador, m = this.m;
    m.taken[q]++; m.marks[q].push(r === 'gol' ? 'g' : r === 'defesa' ? 'd' : 'x'); GS.cobrancasRealizadas++;
    GS.ultimaCobranca = { equipe: q, resultado: r, gx: +b.gx.toFixed(3), gy: +b.gy.toFixed(3) };
    Events.emit(r, { equipe: q, gx: b.gx, gy: b.gy });                      // evento único por cobrança
    // sons ligados ao evento CONFIRMADO (um só resultado por cobrança)
    if (r === 'gol') { sfx('rede'); sfx('gol', .05); crowd('roar'); } else if (r === 'trave') { sfx(b.gy > .955 ? 'travessao' : 'trave'); crowd('groan'); } else if (r === 'defesa') { sfx('defesa'); crowd('groan'); } else { sfx('fora'); crowd('groan'); }
    level(r === 'gol' ? 1 : .6);
    if (r === 'gol') { GS.placar[q]++; Events.emit('placar_alterado', { placar: [...GS.placar] }); }
    // Encerramento antecipado: quem está à frente por mais que as cobranças restantes do outro
    const [a, c] = m.taken, [sa, sc] = GS.placar, ra = Math.max(0, 5 - a), rc = Math.max(0, 5 - c);
    if (a <= 5 || c <= 5) m.fim = sa > sc + rc || sc > sa + ra;
    if (a > 5 || c > 5 || (a >= 5 && c >= 5)) m.fim = a === c && sa !== sc;
    this.wait = 1.9; this.after = true; b.decisiva = m.taken[q] >= 5; GS.estado = 'RESULTADO';
  },
  next() {
    const m = this.m;
    if (m.fim) {
      GS.vencedor = GS.placar[0] > GS.placar[1] ? 0 : 1; GS.estado = 'RESULTADO';
      Events.emit('partida_encerrada', { placar: [...GS.placar], vencedor: GS.vencedor });
      Events.emit(GS.vencedor === 0 ? 'vitoria' : 'derrota'); sfx('vitoria'); crowd('roarBig'); level(1);
      this.fin = { t: 0 }; return;      // comemoração SÓ agora (resultado final confirmado); o callback vem em finish()
    }
    if (GS.cobrador === 1) GS.cobranca++;
    this.setTurn(GS.cobrador ^ 1);
  },
  finish() { const marks = this.m.marks; this.m = null; this.fin = null; ambient(false); this.cb?.(GS.vencedor === 0, [...GS.placar], marks); },
  update(dt) {
    if (this.paused || !this.m) return;
    if (this.fin) { this.fin.t += dt; this.t += dt; if (this.fin.t > 4.4) this.finish(); return; }
    this.t += dt; this.aim.update(dt, cfg.hs, cfg.vs);
    const b = this.ball, k = this.keeper;
    if (GS.estado === 'DEFESA_DO_GOLEIRO' && !b) {                     // adversário prepara o chute
      this.wait -= dt; if (this.wait <= 0) this.launch(Math.min(1.05, Math.max(-.05, .08 + Math.random() * .84)), .12 + Math.random() * .8 + (Math.random() < .08 ? .3 : 0));
    }
    if (b && !b.res) {
      b.t += dt; if (b.t >= 0 && !b.som) { b.som = true; sfx('chute'); }   // som no instante do contato
      if (this.hum() && k.t0 == null && b.t >= k.d.react) {      // CPU reage vendo a direção da bola
        k.t0 = b.t; k.th = Math.max(0, Math.min(1, b.gy + (Math.random() * 2 - 1) * k.d.err*1.5)); const est = b.gx + (Math.random() * 2 - 1) * k.d.err; k.tx = .5 + Math.max(-k.d.dive, Math.min(k.d.dive, est - .5));
      }
      if (k.t0 != null) k.x = .5 + (k.tx - .5) * Math.min(1, (b.t - k.t0) / T_DIVE);
      if (b.t >= T_FLIGHT) this.resolve();
    } else if (b?.res) { b.t += dt; if (this.after && (this.wait -= dt) <= 0) { this.after = false; this.next(); } }
  },
  draw() { if (this.c) Renderer.drawScene?.(this.c, this); }   // desenho 3D em js/scene3d.js
};

const {openMusicPanel}=(function(){
// Painel "Músicas e Torcidas": 4 abas (Playlist do Menu · Cantos das Torcidas · Canto do Campeão · Volume e Reprodução). Tudo salvo no localStorage.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const stTxt = id => { const s = AM.status[id]; return s ? (s.ok ? '✔ funcionando' : '✖ ' + s.msg) : 'não testada'; };
const stCls = id => { const s = AM.status[id]; return s ? (s.ok ? 'ok' : 'err') : ''; };
function openMusicPanel(ctx, tab = 'menu') {
  const { ui, show, TEAMS, crest, back } = ctx; let note = '';
  const save = () => { Store.save(); if (Store.warning) note = Store.warning; };
  const mk = (url, name, cat) => { const r = parseYouTube(url); if (!r.ok) { note = r.error; return null; } note = ''; return { id: uid(), name: (name || '').trim() || 'Música ' + r.id, vid: r.id, start: r.start, vol: 80, enabled: true, cat }; };
  const row = (e, label, attrs) => `<div class="trow">${label}<input class="nm" data-f="name" ${attrs} value="${esc(e.name)}" aria-label="Nome"><span class="st ${stCls(e.id)}" data-sid="${e.id}">${esc(stTxt(e.id))}</span>
    <label class="chk"><input type="checkbox" data-f="en" ${attrs} ${e.enabled ? 'checked' : ''}>ativa</label><input type="range" data-f="vol" ${attrs} min="0" max="100" value="${e.vol}" aria-label="Volume">
    <button class="sm" data-a="test" ${attrs}>${AM.cur?.entry === e ? '■ Parar' : '▶ Testar'}</button><button class="sm sec" data-a="sub" ${attrs}>Substituir</button><button class="sm sec" data-a="del" ${attrs}>Excluir</button><a class="lnk" href="${watchUrl(e.vid)}" target="_blank" rel="noopener">Abrir no YouTube</a></div>`;
  const body = () => {
    const D = Store.data;
    if (tab === 'menu') return `<div class="ctl"><button class="sm" data-a="prev">◀◀</button><button class="sm" data-a="tog">${AM.cur?.kind === 'menu' && AM.playing ? '⏸ Pausar' : '▶ Tocar'}</button><button class="sm" data-a="next">▶▶</button>
        <button class="sm ${D.menu.shuffle ? '' : 'sec'}" data-a="shuf">Aleatório</button><button class="sm ${D.menu.repeat === 'off' ? 'sec' : ''}" data-a="rep">Repetir: ${{ off: 'não', one: 'música', all: 'playlist' }[D.menu.repeat]}</button></div>
      ${D.menu.tracks.length ? D.menu.tracks.map((t, i) => row(t, `<span class="n">${i + 1}</span>`, `data-i="${i}"`).replace('<a class="lnk"', `<button class="sm sec" data-a="up" data-i="${i}">▲</button><button class="sm sec" data-a="dn" data-i="${i}">▼</button><a class="lnk"`)).join('') : '<p>Nenhuma música ainda. Cole um link abaixo.</p>'}
      <div class="trow add"><input id="addName" placeholder="Nome da música" maxlength="60"><input id="addUrl" class="url" placeholder="Cole o link do YouTube" inputmode="url"><select id="addCat"><option value="menu">Menu</option><option value="outra">Outra</option></select><button class="sm" data-a="add">Adicionar</button></div>`;
    if (tab === 'cantos') return `<p class="hint">Um canto por equipe, tocado quando a equipe vai cobrar (momento em "Volume e Reprodução"). Sem canto = áudio padrão.</p>` + TEAMS.map(t => { const e = D.chants[t.key];
      return `<div class="trow"><span class="cr">${crest(t)}</span><b class="tn">${esc(t.nome)}</b><input class="nm" data-team="${t.key}" data-f="cname" placeholder="Nome do canto" maxlength="60" value="${esc(e?.name || '')}"><input class="url" data-team="${t.key}" data-f="curl" placeholder="Link do YouTube" inputmode="url" value="${e ? esc(watchUrl(e.vid)) : ''}">
        <button class="sm" data-a="csave" data-team="${t.key}">Salvar</button>${e ? `<span class="st ${stCls(e.id)}" data-sid="${e.id}">${esc(stTxt(e.id))}</span><label class="chk"><input type="checkbox" data-f="cen" data-team="${t.key}" ${e.enabled ? 'checked' : ''}>ativo</label><input type="range" data-f="cvol" data-team="${t.key}" min="0" max="100" value="${e.vol}"><button class="sm" data-a="ctest" data-team="${t.key}">${AM.cur?.entry === e ? '■ Parar' : '▶ Testar'}</button><button class="sm sec" data-a="cdel" data-team="${t.key}">Remover</button><a class="lnk" href="${watchUrl(e.vid)}" target="_blank" rel="noopener">YouTube</a>` : ''}</div>`; }).join('');
    if (tab === 'camp') { const c = D.champion, one = (k, lab) => { const e = c[k]; return `<div class="trow"><b class="tn">${lab}</b><input class="nm" data-f="kname" data-k="${k}" placeholder="Nome" maxlength="60" value="${esc(e?.name || '')}"><input class="url" data-f="kurl" data-k="${k}" placeholder="Link do YouTube" inputmode="url" value="${e ? esc(watchUrl(e.vid)) : ''}"><button class="sm" data-a="ksave" data-k="${k}">Salvar</button>${e ? `<span class="st ${stCls(e.id)}" data-sid="${e.id}">${esc(stTxt(e.id))}</span><button class="sm" data-a="ktest" data-k="${k}">${AM.cur?.entry === e ? '■ Parar' : '▶ Testar'}</button><button class="sm sec" data-a="kdel" data-k="${k}">Remover</button>` : ''}</div>`; };
      return `<p class="hint">Tocada só quando a disputa termina com vencedor definido (nunca a cada gol).</p><div class="opts">${[['team', 'Canto da própria equipe campeã'], ['exclusive', 'Link exclusivo de comemoração'], ['default', 'Música padrão de vitória'], ['off', 'Sem música de campeão']].map(([k, n]) => `<label class="chk"><input type="radio" name="cm" value="${k}" ${c.mode === k ? 'checked' : ''}> ${n}</label>`).join('')}</div>${one('exclusive', 'Exclusiva')}${one('defaultSong', 'Padrão de vitória')}`; }
    return `<div class="trow"><label class="wide">Volume geral das músicas <input type="range" id="master" min="0" max="100" value="${D.play.master}"></label></div>
      <div class="trow"><label class="wide">Quando o canto da equipe começa <select id="start">${[['apresentacao', 'Na apresentação (início da partida)'], ['preparacao', 'Na preparação do cobrador'], ['cobranca', 'No momento do chute'], ['gol', 'Depois de um gol']].map(([k, n]) => `<option value="${k}" ${D.play.chantStart === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>
      <div class="trow"><label class="chk"><input type="checkbox" id="duck" ${D.play.duckOnKick ? 'checked' : ''}> Abaixar a música durante o chute</label></div>
      <div class="trow"><label class="chk"><input type="checkbox" id="keep" ${D.play.keepMenuInMatch ? 'checked' : ''}> Manter a playlist do menu na partida quando a equipe não tiver canto</label></div>
      <div class="trow"><button class="sm sec" data-a="stopall">■ Parar tudo</button><button class="sm sec" data-a="reset">Restaurar padrões</button><button class="sm sec" data-a="clear">Limpar configurações</button></div>
      <p class="hint">Som no celular/navegador: o áudio só começa depois do seu primeiro toque ou clique. O YouTube pode bloquear vídeos incorporados; o player aparece no canto da tela enquanto toca.</p>`;
  };
  const render = () => {
    const tabs = [['menu', 'Playlist do Menu'], ['cantos', 'Cantos das Torcidas'], ['camp', 'Canto do Campeão'], ['vol', 'Volume e Reprodução']];
    show(`<h2>Músicas e Torcidas</h2><div class="tabs">${tabs.map(([k, n]) => `<button class="sm ${tab === k ? '' : 'sec'}" data-tab="${k}">${n}</button>`).join('')}</div><div class="box pbox">${body()}</div><p id="note" class="note">${esc(note || AM.msg)}</p><button id="b" class="sec">VOLTAR</button>`);
    wire();
  };
  const wire = () => {
    ui.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; note = ''; render(); }); ui.querySelector('#b').onclick = back;
    const D = Store.data, T = el => D.menu.tracks[+el.dataset.i], q = id => ui.querySelector(id);
    ui.querySelectorAll('[data-f]').forEach(el => el.onchange = () => { const f = el.dataset.f, t = el.dataset.i != null ? T(el) : null, ch = el.dataset.team ? D.chants[el.dataset.team] : null;
      if (t && f === 'name') t.name = el.value.slice(0, 60) || t.name; if (t && f === 'en') t.enabled = el.checked; if (t && f === 'vol') { t.vol = +el.value; if (AM.cur?.entry === t) AM.applyVol(); }
      if (ch && f === 'cen') ch.enabled = el.checked; if (ch && f === 'cvol') { ch.vol = +el.value; if (AM.cur?.entry === ch) AM.applyVol(); } save(); });
    ui.querySelectorAll('[data-a]').forEach(el => el.onclick = () => {
      const a = el.dataset.a, i = +el.dataset.i, tm = el.dataset.team, k = el.dataset.k, L = D.menu.tracks;
      if (a === 'test') AM.test(T(el)); else if (a === 'sub') { const r = parseYouTube(prompt('Novo link do YouTube para esta música:') || ''); if (r.ok) { const t = T(el); t.vid = r.id; t.start = r.start; delete AM.status[t.id]; note = ''; save(); } else note = r.error; }
      else if (a === 'del') { if (AM.cur?.entry === T(el)) AM.stop(); L.splice(i, 1); save(); } else if (a === 'up' && i > 0) { [L[i - 1], L[i]] = [L[i], L[i - 1]]; save(); } else if (a === 'dn' && i < L.length - 1) { [L[i + 1], L[i]] = [L[i], L[i + 1]]; save(); }
      else if (a === 'add') { const e = mk(q('#addUrl').value, q('#addName').value, q('#addCat').value); if (e) { L.push(e); save(); } }
      else if (a === 'prev') AM.menuPrev(); else if (a === 'next') AM.menuNext(); else if (a === 'tog') { AM.gestured = true; AM.menuToggle(); }
      else if (a === 'shuf') { D.menu.shuffle = !D.menu.shuffle; save(); } else if (a === 'rep') { D.menu.repeat = { off: 'all', all: 'one', one: 'off' }[D.menu.repeat]; save(); }
      else if (a === 'csave') { const e = mk(q(`[data-f=curl][data-team=${tm}]`).value, q(`[data-f=cname][data-team=${tm}]`).value, 'canto'); if (e) { const old = D.chants[tm]; if (old) { e.vol = old.vol; e.enabled = old.enabled; e.id = old.id; delete AM.status[old.id]; } D.chants[tm] = e; save(); } }
      else if (a === 'ctest') AM.test(D.chants[tm]); else if (a === 'cdel') { if (AM.cur?.entry === D.chants[tm]) AM.stop(); delete D.chants[tm]; save(); }
      else if (a === 'ksave') { const e = mk(q(`[data-f=kurl][data-k=${k}]`).value, q(`[data-f=kname][data-k=${k}]`).value, 'campeao'); if (e) { D.champion[k] = e; save(); } }
      else if (a === 'ktest') AM.test(D.champion[k]); else if (a === 'kdel') { if (AM.cur?.entry === D.champion[k]) AM.stop(); D.champion[k] = null; save(); }
      else if (a === 'stopall') AM.stop(); else if (a === 'reset') { if (confirm('Restaurar todas as configurações de música aos padrões?')) { AM.stop(); Store.reset(); note = 'Padrões restaurados.'; } } else if (a === 'clear') { if (confirm('Apagar todas as músicas e cantos salvos?')) { AM.stop(); Store.clear(); note = 'Configurações apagadas.'; } }
      AM.gestured = true; render(); });
    ui.querySelectorAll('input[name=cm]').forEach(r => r.onchange = () => { D.champion.mode = r.value; save(); });
    const m = q('#master'); if (m) m.oninput = () => { D.play.master = +m.value; AM.applyVol(); save(); }; const s = q('#start'); if (s) s.onchange = () => { D.play.chantStart = s.value; save(); };
    const d = q('#duck'); if (d) d.onchange = () => { D.play.duckOnKick = d.checked; save(); }; const kp = q('#keep'); if (kp) kp.onchange = () => { D.play.keepMenuInMatch = kp.checked; save(); };
  };
  AM.onChange = () => { ui.querySelectorAll('[data-sid]').forEach(e => { e.textContent = stTxt(e.dataset.sid); e.className = 'st ' + stCls(e.dataset.sid); }); const n = ui.querySelector('#note'); if (n && AM.msg) n.textContent = AM.msg; };   // atualiza só os status (não perde o que está sendo digitado)
  render();
}
return {openMusicPanel};})();
// Interface: menu, seleção de times/jogadores, playlist, configurações, campeonato e telas de resultado.
const ui = document.getElementById('ui'), cv = document.getElementById('cv'), app = document.getElementById('app'), back = document.getElementById('back');
let sel = { a: null, b: null }, escolha = [null, null], cup = null, mode = 'solo', me = null;
// --- layout: UI lógica 960x540 escalada; canvas com resolução interna × devicePixelRatio ---
function fit() { const narrow = window.innerWidth < 820; ui.classList.toggle('flow', narrow); document.body.classList.toggle('narrow', narrow); const s = narrow ? 1 : app.clientWidth / 960, d = window.devicePixelRatio || 1; ui.style.transform = narrow ? 'none' : `scale(${s})`; const cs = app.clientWidth / 960; cv.width = Math.round(960*cs*d); cv.height = Math.round(540*cs*d); }
window.addEventListener('resize', fit); fit();
const fallback = t => `<svg viewBox="0 0 46 54"><path d="M3 3h40v26c0 13-12 20-20 23C15 49 3 42 3 29z" fill="#2a3b52" stroke="#8da2bd" stroke-width="2"/><text x="23" y="32" font-size="14" font-weight="900" text-anchor="middle" fill="#fff">${t.sigla}</text></svg>`;
// escudo: só pede o PNG se a key estiver em CRESTS (teams.js) → sem erros 404 quando o arquivo não existe
const crest = t => CRESTS.includes(t.key) ? `<img src="assets/crests/${t.key}.png" alt="${t.sigla}" title="${t.nome}" onerror="this.outerHTML=''">` : fallback(t);
const show = h => { ui.className = window.innerWidth < 820 ? 'flow' : ''; ui.innerHTML = h; back.hidden = true; };
const hide = () => { ui.className = 'off'; back.hidden = false; };
const on = (id, f) => { const e = document.getElementById(id); if (e) e.onclick = f; };
const T = i => TEAMS[i];
Store.load(); AM.init(); Game.init(cv); Music.init(); Arduino.registrarComandos({ iniciar: () => Game.restart(), pausar: () => Game.paused = !Game.paused, reiniciar: () => Game.restart() }); Arduino.iniciar();
back.onclick = () => { Game.stop(); Music.setMode('menu'); menu(); };
document.addEventListener('pointerdown', () => AM.userGesture(), { once: true });   // áudio só depois da 1ª interação (política dos navegadores)
document.addEventListener('pointerdown', () => { if (!Music.playing && !Music.msg && Music.tracks.length && !GS.equipes[0]?.jogando) Music.play(); }, { once: true });

function menu() { GS.estado = 'MENU'; Music.onChange = null; AM.onChange = null; Music.setMode('menu'); if (AM.gestured) AM.enterMenu();
  show(`<h1>PÊNALTI MÁXIMO</h1><p>${sel.a != null ? `${T(sel.a).nome} x ${sel.b != null ? T(sel.b).nome : 'sorteio'}` : 'Segure, mire no tempo certo e solte.'}</p><div class="menu">
  <button id="solo">JOGAR SOZINHO</button><button id="duo">JOGAR COM ALGUÉM</button><button id="tm" class="sec">ESCOLHER TIMES</button><button id="pj" class="sec">ESCOLHER JOGADORES</button>
  <button id="cp" class="sec">CAMPEONATO</button><button id="pl" class="sec">MÚSICAS E TORCIDAS</button><button id="cf" class="sec">CONFIGURAÇÕES</button><button id="hw" class="sec">COMO JOGAR</button></div>`);
  on('solo', () => need('solo')); on('duo', () => need('duo')); on('tm', () => pickTeam('a', 'Time do Jogador 1', () => pickTeam('b', 'Time do Jogador 2 / adversário', menu))); on('pj', pickPlayers);
  on('cp', () => need('copa')); on('pl', () => openMusicPanel({ ui, show, TEAMS, crest, back: menu })); on('cf', settings); on('hw', how); }
function need(m) { mode = m; const go = () => m === 'duo' && sel.b == null ? pickTeam('b', 'Time do Jogador 2', go) : launch(); sel.a == null ? pickTeam('a', m === 'duo' ? 'Time do Jogador 1' : 'Escolha seu time', go) : go(); }
function pickTeam(slot, title, next) { GS.estado = 'SELECAO_EQUIPE';
  show(`<h2>${title}</h2><div class="grid">${TEAMS.map(t => `<div class="card" data-i="${t.id}">${crest(t)}<br>${t.nome}</div>`).join('')}</div><button id="b" class="sec">VOLTAR</button>`);
  ui.querySelectorAll('.card').forEach(c => c.onclick = () => { sel[slot] = +c.dataset.i; if (slot === 'a') escolha[0] = null; else escolha[1] = null; next(); }); on('b', menu); }
function pickPlayers() { if (sel.a == null) return pickTeam('a', 'Primeiro escolha o time do Jogador 1', pickPlayers);
  const slots = sel.b == null ? [0] : [0, 1], one = s => { const t = T(s ? sel.b : sel.a), sq = squad(t);
    show(`<h2>Cobrador — ${t.nome} (${sq.filter(p => !p.pending).length} confirmados)</h2><div class="box"><div class="pl"><button data-p="" class="sec">★ AUTOMÁTICO</button>${sq.map(p => `<button data-p="${p.id}" ${p.isStar ? '' : 'class="sec"'}>${p.isStar ? '★ ' : ''}${p.pending ? 'Pendente' : (p.nickname || p.name)} · ${p.jerseyNumber ?? '?'} · ${p.rating}</button>`).join('')}</div><p style="font-size:12px;margin-top:8px">Elencos verificados: só atletas com fonte e data em js/players.js. "Pendente" = elenco não verificado; "?" = camisa não confirmada. Dados e fontes em js/lineups/clubs/.</p></div><button id="b" class="sec">VOLTAR</button>`);
    ui.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { escolha[s] = b.dataset.p || null; s < slots.length - 1 ? one(s + 1) : menu(); }); on('b', menu); }; one(0); }
function launch() { if (mode === 'copa') { cup = new Cup(sel.a); return cupScreen(); } const b = mode === 'duo' ? sel.b : (sel.b ?? T(sel.a).id === 0 ? 1 : 0); versus(sel.a, mode === 'duo' || sel.b != null ? sel.b : [...TEAMS.keys()].filter(i => i !== sel.a)[Math.floor(Math.random() * 19)]); }
function versus(a, b) { me = a; show(`<h2>${mode === 'copa' ? cup.stageName() : mode === 'duo' ? 'Dois jogadores' : 'Amistoso'}</h2><div style="display:flex;gap:30px;align-items:center">${crest(T(a))}<h1>VS</h1>${crest(T(b))}</div><h3>${T(a).nome} x ${T(b).nome}</h3><button id="go">INICIAR DISPUTA</button><button id="b" class="sec">VOLTAR</button>`);
  on('b', menu); on('go', () => { hide(); Music.setMode('game'); Game.start(T(a), T(b), (win, [x, y], marks) => end(win, x, y, a, b, marks), mode === 'duo', escolha); }); }
function resumo(marks) { const s = m => m.map(v => `<span style="color:${v === 'g' ? '#38b000' : v === 'd' ? '#4cc9f0' : '#e63946'}">${v === 'g' ? '● gol' : v === 'd' ? '● defesa' : '● fora/trave'}</span>`).join(' '); return `<div class="box" style="font-size:12px">${[0, 1].map(i => `<b>${GS.equipes[i].nome}:</b> ${s(marks[i])}`).join('<br>')}</div>`; }
function end(win, x, y, a, b, marks) { Music.setMode('menu');
  if (mode === 'copa') { cup.playerResult(x, y); return cupScreen(win, x, y, a, b); }
  const msg = mode === 'duo' ? `${T(win ? a : b).nome} venceu!` : win ? 'VITÓRIA!' : 'DERROTA';
  show(`<h1>${msg}</h1><h2>${T(a).nome} ${x} x ${y} ${T(b).nome}</h2>${resumo(marks)}<button id="r">REVANCHE</button><button id="m" class="sec">VOLTAR AO MENU</button>`);
  on('r', () => { hide(); Music.setMode('game'); Game.restart(); }); on('m', menu); }
function cupScreen(win, x, y, a, b) {
  if (cup.champion !== null) { GS.estado = 'CAMPEONATO_FINALIZADO'; const t = T(cup.champion); show(`<h1>${cup.champion === sel.a ? 'CAMPEÃO!' : 'CAMPEONATO ENCERRADO'}</h1>${crest(t)}<h2>${t.nome}</h2><div class="box" style="font-size:12px">${cup.hist.slice(-8).join('<br>')}</div><button id="m">MENU</button>`); on('m', menu); cup = null; return; }
  const nx = cup.alive ? cup.nextForMe() : null, res = win == null ? '' : `<p>Último jogo: ${T(a).nome} ${x} x ${y} ${T(b).nome} — ${win ? 'vitória' : 'derrota'}</p>`;
  const tbl = cup.groups.map((g, i) => `<table><tr><th>Grupo ${'ABCD'[i]}</th><th>P</th><th>V</th><th>D</th><th>SG</th></tr>${cup.rank(g).map(id => { const r = cup.tab[id]; return `<tr${id === sel.a ? ' style="color:#ffe66d"' : ''}><td>${cup.name(id)}</td><td>${r.pts}</td><td>${r.w}</td><td>${r.l}</td><td>${r.gf - r.ga}</td></tr>`; }).join('')}</table>`).join('');
  show(`<h2>${cup.stageName()}</h2>${res}<div class="box" style="display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;font-size:11px">${tbl}</div>${nx ? `<button id="n">PRÓXIMO: vs ${cup.name(nx[1])}</button>` : ''}<button id="m" class="sec">SAIR</button>`);
  if (nx) on('n', () => { mode = 'copa'; versus(nx[0], nx[1]); }); on('m', menu); }
function how() { show(`<h2>Como jogar</h2><div class="box" style="max-width:700px"><b>Cobrando:</b> a linha amarela oscila sozinha. <b>Clique e solte</b> = chute rasteiro na posição da linha; <b>segure</b> o botão = o marcador de altura sobe enquanto a linha continua se movendo; solte para chutar (espere o cobrador chegar à bola). Tecla <b>M</b> silencia.<br><b>Defendendo (modo sozinho):</b> setas ← ↑ → logo após o chute adversário.<br><b>Jogar com alguém:</b> dois jogadores no mesmo computador alternam as cobranças com o mouse; os goleiros são da IA.<br><b>Regras:</b> 5 cobranças por time, alternadas; a disputa termina antes se um time não puder mais alcançar o outro; empate vai para morte súbita.<br><b>☰ MENU</b> (canto superior esquerdo) volta ao menu durante a partida.</div><button id="b">VOLTAR</button>`); on('b', menu); }
function settings() { show(`<h2>Configurações</h2><div class="box"><label>Mira horizontal<input id="hs" type="range" min=".4" max="2" step=".1" value="${cfg.hs}"></label><label>Mira vertical<input id="vs" type="range" min=".2" max="1.4" step=".1" value="${cfg.vs}"></label>
<label>Goleiro<select id="df">${['easy', 'normal', 'hard'].map(d => `<option value="${d}" ${cfg.diff === d ? 'selected' : ''}>${{ easy: 'Fácil', normal: 'Normal', hard: 'Difícil' }[d]}</option>`).join('')}</select></label>
<label>Efeitos sonoros<input id="sn" type="checkbox" ${cfg.sound ? 'checked' : ''}></label><label>Volume dos efeitos<input id="vl" type="range" min="0" max="1" step=".1" value="${cfg.vol}"></label><label>Volume da torcida<input id="vc" type="range" min="0" max="1" step=".1" value="${cfg.volCrowd}"></label><label>Volume da música<input id="vm" type="range" min="0" max="1" step=".05" value="${Music.vol}"></label></div><button id="rc" class="sec">REINICIAR CAMPEONATO</button><button id="b">VOLTAR</button>`);
  const bind = (id, k, f) => document.getElementById(id).oninput = e => cfg[k] = f(e.target);
  bind('hs', 'hs', e => +e.value); bind('vs', 'vs', e => +e.value); bind('df', 'diff', e => e.value); bind('sn', 'sound', e => e.checked); bind('vl', 'vol', e => +e.value); bind('vc', 'volCrowd', e => +e.value); document.getElementById('vm').oninput = e => Music.setVol(+e.target.value); on('rc', () => { cup = null; alert('Campeonato reiniciado.'); }); on('b', menu); }
document.addEventListener('click', e => { if (e.target.closest('button,.card')) sfx('click'); });
window.addEventListener('keydown', e => { if (e.key === 'm' || e.key === 'M') { cfg.sound = !cfg.sound; ambient(cfg.sound && !!Game.m && !Game.fin); } });   // M = silenciar/ativar
// Motor 3D (Three.js + GLB) é o motor do jogo. O procedural (scene3d.js) só é usado com ?engine=2d (ou no jogar.html, que define window.ENGINE = '2d').
// Se o 3D falhar, o jogo NÃO troca de motor em silêncio: mostra o motivo e deixa o jogador escolher tentar de novo ou abrir o motor antigo.
function engineError(err) {
  const m = String(err && err.message || err), why = /dynamically imported|resolve module|Failed to fetch/.test(m) ? 'Three.js ou o modelo não foram encontrados (abra o jogo por um servidor local; rode: node tools/check-3d-setup.mjs).' : /WebGL/i.test(m) ? 'Este navegador/computador não liberou o WebGL.' : m.split('\n')[0].slice(0, 160);
  const d = document.createElement('div'); d.id = 'engine-error'; d.innerHTML = `<div class="box"><h2>Não foi possível abrir o jogo em 3D</h2><p>${why}</p><button id="ee-retry">TENTAR DE NOVO</button><button id="ee-2d" class="sec">USAR O MOTOR ANTIGO (2D)</button></div>`;
  Object.assign(d.style, { position: 'absolute', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(5,10,20,.88)', zIndex: 50, textAlign: 'center' }); app.appendChild(d);
  d.querySelector('#ee-retry').onclick = () => location.reload(); d.querySelector('#ee-2d').onclick = () => { const u = new URL(location.href); u.searchParams.set('engine', '2d'); location.href = u.href; };
}
if ((new URLSearchParams(location.search).get('engine') || window.ENGINE) !== '2d') {
  import('./three/engine.js').then(m => m.start({ cv })).then(() => console.info('Motor 3D (Three.js/GLB) ativo.')).catch(err => { console.error('Motor 3D indisponível:', err); engineError(err); });
}
menu();
window.JOGO = { GS, Events, Game, DBG };   // depuração/integração: JOGO.GS.placar, JOGO.Events.on('gol', ...)
})();
