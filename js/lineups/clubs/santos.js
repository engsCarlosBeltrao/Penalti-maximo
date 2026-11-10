// santos: titulares (escalação-tipo do PROJETO, não a escalação oficial). Atualize aqui nome/número/posição; a aparência fica em ../appearance.js.
// n: número da camisa (null = não confirmado, aparece como "?"). pos: GK RB CB LB DM CM AM RW LW ST. star/r/cel/foot: critério do projeto.
export const L_santos = {
  club: "santos", source: "Wikipédia (en), \"2026 Santos FC season\", tabela do elenco \"As of 8 out 2026\"", verifiedAt: "2026-10-08", numbers: "confirmed", confidence: "alta",
  note: "Neymar (10) e Gabigol (9) também em Itatiaia/Tribuna de Jundiaí.",
  xi: [
    { n: 77, name: "Gabriel Brazão", nick: "Brazão", pos: "GK" },
    { n: 23, name: "Rodinei", pos: "RB" },
    { n: 14, name: "Luan Peres", pos: "CB", foot: "left" },   // pé: Transfermarkt (perfil 347913), conferido em 10/11/2026
    { n: 4, name: "Lucas Veríssimo", nick: "Veríssimo", pos: "CB" },
    { n: 3, name: "Vinicius Lira", pos: "LB", foot: "left" },   // pé: Transfermarkt (perfil 1253844), conferido em 10/11/2026
    { n: 5, name: "João Schmidt", nick: "Schmidt", pos: "DM", foot: "left" },   // pé: Transfermarkt (perfil 198859), conferido em 10/11/2026
    { n: 32, name: "Benjamín Rollheiser", nick: "Rollheiser", pos: "CM", foot: "left" },   // pé: Transfermarkt (perfil 491704), conferido em 10/11/2026
    { n: 10, name: "Neymar Jr.", nick: "Neymar", pos: "AM", star: true, r: 92, cel: "confident", foot: "right" },
    { n: 7, name: "Everton Cebolinha", nick: "Cebolinha", pos: "RW" },
    { n: 9, name: "Gabriel Barbosa", nick: "Gabigol", pos: "ST", star: true, r: 88, cel: "arms", foot: "left" },
    { n: 22, name: "Álvaro Barreal", nick: "Barreal", pos: "LW", foot: "left" }   // pé: Transfermarkt (perfil 613873), conferido em 10/11/2026
  ]
};
