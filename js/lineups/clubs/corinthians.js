// corinthians: titulares (escalação-tipo do PROJETO, não a escalação oficial). Atualize aqui nome/número/posição; a aparência fica em ../appearance.js.
// n: número da camisa (null = não confirmado, aparece como "?"). pos: GK RB CB LB DM CM AM RW LW ST. star/r/cel/foot: critério do projeto.
export const L_corinthians = {
  club: "corinthians", source: "Wikipédia (en), \"2026 SC Corinthians Paulista season\", tabela do elenco \"As of 21 fev 2026 (\"Squad numbers last updated\")\"", verifiedAt: "2026-02-21", numbers: "confirmed", confidence: "baixa",
  note: "Números de fev/2026; transferências do segundo semestre não verificadas.",
  xi: [
    { n: 1, name: "Hugo Souza", pos: "GK" },
    { n: 2, name: "Matheuzinho", pos: "RB" },
    { n: 3, name: "Gabriel Paulista", pos: "CB" },
    { n: 5, name: "André Ramalho", pos: "CB" },
    { n: 21, name: "Matheus Bidu", nick: "Bidu", pos: "LB", foot: "left" },   // pé: Transfermarkt (perfil 670021), conferido em 10/11/2026
    { n: 14, name: "Raniele", pos: "DM" },
    { n: 7, name: "Breno Bidon", nick: "Bidon", pos: "CM", foot: "left" },   // pé: Transfermarkt (perfil 1029227), conferido em 10/11/2026
    { n: 8, name: "Rodrigo Garro", nick: "Garro", pos: "AM", foot: "left" },   // pé: Transfermarkt (perfil 565009), conferido em 10/11/2026
    { n: 11, name: "Vitinho", pos: "RW" },
    { n: 9, name: "Yuri Alberto", pos: "ST" },
    { n: 10, name: "Memphis Depay", nick: "Memphis", pos: "LW", star: true, r: 88, cel: "confident" }
  ]
};
