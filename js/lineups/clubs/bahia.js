// bahia: titulares (escalação-tipo do PROJETO, não a escalação oficial). Atualize aqui nome/número/posição; a aparência fica em ../appearance.js.
// n: número da camisa (null = não confirmado, aparece como "?"). pos: GK RB CB LB DM CM AM RW LW ST. star/r/cel/foot: critério do projeto.
export const L_bahia = {
  club: "bahia", source: "Wikipédia (en), \"2026 Esporte Clube Bahia season\", tabela do elenco \"As of 28 mar 2026\"", verifiedAt: "2026-03-28", numbers: "confirmed", confidence: "baixa",
  note: "Fonte de março/2026; transferências posteriores não verificadas.",
  xi: [
    { n: 1, name: "Ronaldo", pos: "GK" },
    { n: 2, name: "Gilberto", pos: "RB" },
    { n: 3, name: "Gabriel Xavier", nick: "Xavier", pos: "CB" },
    { n: 4, name: "Kanu", pos: "CB" },
    { n: 46, name: "Luciano Juba", nick: "Juba", pos: "LB", foot: "left" },   // pé: Transfermarkt (perfil 676035), conferido em 10/11/2026
    { n: 5, name: "Nicolás Acevedo", nick: "Acevedo", pos: "DM" },
    { n: 6, name: "Jean Lucas", pos: "CM" },
    { n: 10, name: "Éverton Ribeiro", nick: "Ribeiro", pos: "AM", foot: "left" },   // pé: Transfermarkt (perfil 52896, "Everton Ribeiro"), conferido em 10/11/2026
    { n: 7, name: "Ademir", pos: "RW", foot: "left" },   // pé: Transfermarkt (perfil 544259), conferido em 10/11/2026
    { n: 12, name: "Willian José", pos: "ST" },
    { n: 16, name: "Erick Pulga", nick: "Pulga", pos: "LW" }
  ]
};
