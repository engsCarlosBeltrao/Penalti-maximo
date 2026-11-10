// flamengo: titulares (escalação-tipo do PROJETO, não a escalação oficial). Atualize aqui nome/número/posição; a aparência fica em ../appearance.js.
// n: número da camisa (null = não confirmado, aparece como "?"). pos: GK RB CB LB DM CM AM RW LW ST. star/r/cel/foot: critério do projeto.
export const L_flamengo = {
  club: "flamengo", source: "Wikipédia (en), \"2026 CR Flamengo season\", tabela do elenco \"As of 19 set 2026\"", verifiedAt: "2026-09-19", numbers: "confirmed", confidence: "alta",
  note: "Números conferidos também em flavoz.com.br e vavel.com.br (08/10/2026).",
  xi: [
    { n: 1, name: "Agustín Rossi", nick: "Rossi", pos: "GK" },
    { n: 2, name: "Guillermo Varela", nick: "Varela", pos: "RB" },
    { n: 4, name: "Léo Pereira", pos: "CB", foot: "left" },   // pé: Transfermarkt (perfil 288431), conferido em 10/11/2026
    { n: 13, name: "Danilo", pos: "CB" },
    { n: 6, name: "Ayrton Lucas", pos: "LB", foot: "left" },   // pé: Transfermarkt (perfil 349585), conferido em 10/11/2026
    { n: 21, name: "Jorginho", pos: "DM", foot: "right" },   // pé: Transfermarkt (perfil 102017), conferido em 02/11/2026
    { n: 11, name: "Lucas Paquetá", nick: "Paquetá", pos: "AM", star: true, r: 87, cel: "confident", foot: "left" },   // pé: Transfermarkt (perfil 444523), conferido em 10/11/2026
    { n: 10, name: "Giorgian de Arrascaeta", nick: "Arrascaeta", pos: "AM", star: true, r: 90, cel: "crest", foot: "right" },   // pé: Transfermarkt (perfil 248410), conferido em 02/11/2026
    { n: 7, name: "Luiz Araújo", pos: "RW", foot: "left" },   // pé: Transfermarkt (perfil 435485), conferido em 10/11/2026
    { n: 27, name: "Bruno Henrique", pos: "LW" },
    { n: 9, name: "Pedro", pos: "ST", star: true, r: 86, cel: "arms" }
  ],
  reserves: [
    { n: 15, name: "Jorge Carrascal", nick: "Carrascal", pos: "AM" }
  ]
};
