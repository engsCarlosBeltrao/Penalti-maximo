// APARÊNCIA DOS TITULARES. Os 220 titulares têm aparência OBSERVADA em fotos (rosto oficial do Transfermarkt, só de frente; data da foto em "foto").
// Fora da tabela (reservas, jogadores novos) vale uma ESTIMATIVA determinística por id (mesmo atleta = mesma aparência sempre), que não é retrato de ninguém.
// Linha da tabela REAL (chave = id do jogador sem o clube, dentro do clube): 'penteado|cor|pele|barba|bigode|costeleta|foto|extras'
//   penteado: peça Hair_<id> de tools/hair-geometry.mjs (careca, rente, degrade_medio, topete_degrade, crespo_curto, black_power, trancas_nago…)
//   cor: preto|cesc (castanho-escuro)|cast|cclaro|loiro|ruivo|grisalho|plat (as 8 cores de HAIRC);  pele: 0 (muito clara) … 5 (negra)
//   barba: nenhuma|por_fazer|cavanhaque|queixo|cheia_curta|cheia_media|densa|longa;  bigode: nenhum|bigode_fino|bigode|bigode_marcado;  costeleta: raspada|curta|ligada|coberta
//   extras (opcional, separados por ;): c2=cor (lateral/raiz), bc=cor (barba), hl=cor e ha=0..1 (mechas), tp=0..1 (pontas descoloridas, cor hl), gr=0..1 (grisalho), bd=#cor (faixa),
//   conf=pendente (sem foto: visual neutro) | duvida (foto achada em outro clube / identidade incerta).
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
  botafogo: { raul: 'degrade_medio|preto|2|nenhuma|nenhum|raspada|-|conf=pendente', vitinho: 'crespo_degrade|preto|4|cheia_curta|bigode|ligada|2021-07', 'mateo-ponte': 'franja_media|preto|2|nenhuma|nenhum|curta|2023-02',
    bastos: 'crespo_curto|preto|5|nenhuma|nenhum|curta|2021-10', 'alex-telles': 'topete|preto|1|cheia_curta|bigode|ligada|2022-08', allan: 'social_risca|preto|2|cavanhaque|bigode|curta|2015-11',
    danilo: 'dreads_degrade|preto|5|nenhuma|nenhum|raspada|2026-06', 'alvaro-montoro': 'crop_franja|cesc|1|nenhuma|nenhum|curta|2024-07', artur: 'degrade_medio|preto|2|nenhuma|nenhum|raspada|-|conf=pendente',
    'arthur-cabral': 'raspado_entradas|cesc|1|cheia_curta|bigode|ligada|2023-11', 'matheus-martins': 'crop_franja|loiro|2|nenhuma|nenhum|raspada|2022-12|c2=preto' },
  fluminense: { fabio: 'social_risca|preto|2|cheia_curta|bigode|ligada|2025-07|gr=.45', 'samuel-xavier': 'crespo_degrade|preto|4|longa|bigode|ligada|2025-07', ignacio: 'topete_degrade|cesc|1|cheia_curta|bigode|ligada|2024-07',
    freytes: 'crop_franja|preto|1|cheia_curta|bigode|ligada|2025-07', 'guilherme-arana': 'degrade_medio|preto|2|nenhuma|nenhum|raspada|2024-06', 'facundo-bernal': 'crop_franja|cesc|1|nenhuma|nenhum|curta|2026-09',
    martinelli: 'topete_degrade|cesc|1|cavanhaque|bigode|raspada|2023-05', ganso: 'espetado|preto|2|por_fazer|nenhum|curta|2025-07', keno: 'crespo_curto|preto|5|nenhuma|nenhum|curta|2024-09',
    'german-cano': 'liso_desfiado|preto|2|nenhuma|nenhum|coberta|2025-07', 'yeferson-soteldo': 'crop_franja|plat|1|por_fazer|nenhum|raspada|2025-07|c2=preto' },
  vasco: { 'leo-jardim': 'social_risca|cesc|1|por_fazer|nenhum|curta|2025-04', 'puma-rodriguez': 'penteado_tras|preto|2|nenhuma|nenhum|raspada|2026-03', 'robert-renan': 'crespo_curto|preto|4|nenhuma|nenhum|curta|2023-01',
    'lucas-freitas': 'degrade_medio|preto|2|cavanhaque|bigode_fino|raspada|2024-01', 'lucas-piton': 'topete_degrade|cclaro|1|nenhuma|nenhum|raspada|2025-01', 'santiago-sosa': 'ondulado_medio|cesc|1|por_fazer|nenhum|curta|2023-03',
    'tche-tche': 'trancas_nago|preto|5|nenhuma|nenhum|raspada|2025-05', 'johan-rojas': 'cacheado_degrade|preto|2|nenhuma|nenhum|raspada|2024-04', 'nuno-moreira': 'cacheado_medio|cesc|1|por_fazer|nenhum|coberta|2025-10',
    brenner: 'crespo_degrade|preto|4|cavanhaque|bigode_fino|raspada|2025-09', 'andres-gomez': 'crespo_curto|preto|5|nenhuma|bigode_fino|curta|2026-06' },
  bahia: { ronaldo: 'ondulado_medio|preto|2|cheia_curta|bigode|ligada|2018-12', gilberto: 'degrade_medio|preto|3|cavanhaque|bigode|raspada|2020-10|conf=duvida', 'gabriel-xavier': 'degrade_medio|preto|2|nenhuma|nenhum|raspada|2022-08|conf=duvida',
    kanu: 'crespo_curto|preto|4|cavanhaque|nenhum|curta|2026-02', 'luciano-juba': 'degrade_medio|preto|2|nenhuma|bigode_fino|raspada|2023-09', 'nicolas-acevedo': 'degrade_medio|preto|1|por_fazer|nenhum|raspada|2025-06',
    'jean-lucas': 'crespo_degrade|preto|4|nenhuma|nenhum|raspada|2022-10', 'everton-ribeiro': 'penteado_tras|cclaro|1|cheia_curta|bigode|ligada|2021-01', ademir: 'crespo_degrade|preto|4|nenhuma|nenhum|raspada|2020-12',
    'willian-jose': 'topete_degrade|preto|2|densa|bigode|ligada|2024-07|gr=.25', 'erick-pulga': 'degrade_medio|preto|2|nenhuma|nenhum|raspada|2024-02' },
  sport: { halls: 'degrade_medio|preto|2|nenhuma|nenhum|raspada|-|conf=pendente', madson: 'crespo_curto|preto|4|nenhuma|nenhum|curta|2018-01|conf=duvida', 'marcelo-benevenuto': 'crespo_curto|preto|5|nenhuma|nenhum|curta|2020-05',
    'ze-marcos': 'crop_franja|cesc|1|cavanhaque|bigode_fino|curta|2023-10', 'marcelo-ajul': 'degrade_medio|preto|2|nenhuma|nenhum|raspada|-|conf=pendente', 'max-alves': 'crespo_degrade|preto|4|nenhuma|nenhum|raspada|2023-03|conf=duvida',
    'yago-felipe': 'social_risca|preto|2|cheia_curta|bigode|ligada|2026-05', 'carlos-de-pena': 'social_risca|cesc|1|por_fazer|nenhum|curta|2021-02', micael: 'crespo_degrade|preto|4|cheia_media|bigode|ligada|2026-02|conf=duvida',
    'pedro-perotti': 'crop_franja|cesc|2|nenhuma|nenhum|raspada|2025-10', 'gustavo-maia': 'crop_franja|preto|2|nenhuma|nenhum|raspada|2025-10' },
  fortaleza: { 'joao-ricardo': 'penteado_tras|cast|1|cavanhaque|bigode|curta|2022-09', mailton: 'degrade_medio|preto|3|cavanhaque|nenhum|raspada|2021-08', 'lucas-gazal': 'rente|cast|1|cavanhaque|bigode|raspada|2022-09',
    bastos: 'crespo_curto|preto|5|nenhuma|nenhum|curta|2021-10', neris: 'social_risca|preto|1|cavanhaque|nenhum|curta|2020-01', mucuri: 'crespo_degrade|preto|4|nenhuma|bigode_fino|raspada|2024-05',
    pierre: 'degrade_medio|preto|3|cavanhaque|nenhum|raspada|2022-09', 'eduardo-sasha': 'crop_franja|cclaro|1|cheia_curta|bigode|ligada|2022-11', rodriguinho: 'crespo_degrade|loiro|4|nenhuma|nenhum|raspada|2023-04|c2=preto',
    'luiz-fernando': 'degrade_medio|preto|2|cavanhaque|nenhum|raspada|2022-09', cantillo: 'crespo_curto|preto|5|nenhuma|nenhum|curta|2025-10' },
  ceara: { richard: 'cacheado_medio|cesc|1|por_fazer|nenhum|curta|2024-02|conf=duvida', 'bryan-borges': 'crop_franja|preto|1|cheia_curta|bigode|ligada|2022-01', 'julio-cesar': 'raspado_entradas|preto|3|cheia_curta|bigode|ligada|2023-04',
    luizao: 'crespo_degrade|preto|4|cavanhaque|nenhum|raspada|2022-08', sanchez: 'social_risca|cast|1|cavanhaque|bigode|curta|2022-09', richardson: 'social_risca|preto|1|cheia_curta|bigode|ligada|2024-02',
    'joao-gabriel': 'ondulado_medio|cclaro|1|por_fazer|bigode_fino|curta|2026-06', melk: 'degrade_medio|preto|2|nenhuma|nenhum|raspada|2026-06', 'matheus-araujo': 'crop_franja|preto|1|nenhuma|nenhum|raspada|2025-05',
    enzo: 'degrade_medio|preto|2|nenhuma|nenhum|raspada|-|conf=pendente', 'saulo-mineiro': 'crespo_degrade|preto|4|cavanhaque|bigode|raspada|2023-09' },
  'athletico-pr': { mycael: 'degrade_medio|preto|2|nenhuma|nenhum|raspada|2022-08', gilberto: 'degrade_medio|preto|3|cavanhaque|bigode|raspada|2020-10', teran: 'crespo_curto|preto|5|por_fazer|nenhum|curta|2025-02',
    jadson: 'penteado_tras|preto|1|densa|bigode|ligada|2022-08', leo: 'crespo_degrade|preto|5|nenhuma|nenhum|raspada|2025-01', felipinho: 'cacheado_degrade|preto|2|nenhuma|nenhum|raspada|2024-09',
    giuliano: 'penteado_tras|cesc|1|cheia_curta|bigode|ligada|2024-01|conf=duvida', 'bruno-zapelli': 'crop_franja|preto|1|nenhuma|nenhum|raspada|2024-06', mendoza: 'crespo_curto|preto|5|cheia_curta|bigode|ligada|2024-02',
    'kevin-viveros': 'crespo_degrade|preto|5|nenhuma|nenhum|raspada|2024-10|hl=loiro;tp=.9', isaac: 'degrade_medio|preto|2|nenhuma|nenhum|raspada|-|conf=pendente' },
  coritiba: { 'pedro-morisco': 'social_risca|cesc|1|nenhuma|nenhum|curta|2024-01', tinga: 'raspado_entradas|preto|4|cheia_curta|bigode|ligada|2026-05', maicon: 'rente|cast|1|cavanhaque|bigode|raspada|2017-10',
    'tiago-coser': 'social_risca|cast|1|nenhuma|nenhum|curta|2024-01', 'bruno-melo': 'social_risca|preto|2|cheia_curta|bigode|ligada|2020-08', 'willian-oliveira': 'crespo_degrade|preto|4|cavanhaque|nenhum|raspada|2022-08',
    'vini-paulista': 'topete_degrade|preto|2|cheia_curta|bigode|ligada|2023-01', 'thiago-santos': 'penteado_tras|preto|3|cheia_curta|bigode|ligada|2020-03', 'pedro-rocha': 'crespo_degrade|preto|4|nenhuma|nenhum|raspada|2019-03',
    lavega: 'crop_franja|cast|1|nenhuma|nenhum|raspada|2024-07', 'breno-lopes': 'rente|preto|2|nenhuma|nenhum|raspada|2021-02' },
  bragantino: { cleiton: 'penteado_tras|cesc|1|cheia_curta|bigode|ligada|2025-10', 'agustin-sant-anna': 'social_risca|preto|2|nenhuma|nenhum|curta|2024-07', 'gustavo-marques': 'rente|preto|5|nenhuma|bigode_fino|raspada|2024-01',
    'alix-vinicius': 'cacheado_degrade|preto|4|por_fazer|nenhum|raspada|2024-07', 'juninho-capixaba': 'ondulado_medio|cclaro|1|cheia_media|bigode|ligada|2024-06', fabinho: 'crop_franja|preto|1|nenhuma|nenhum|curta|2022-08',
    'eric-ramires': 'crespo_degrade|preto|5|nenhuma|nenhum|raspada|2022-09', 'bruno-praxedes': 'social_risca|preto|2|nenhuma|nenhum|curta|2022-09', 'eduardo-sasha': 'crop_franja|cclaro|1|cheia_curta|bigode|ligada|2022-11',
    'isidro-pitta': 'social_risca|ruivo|1|cheia_media|bigode|ligada|2025-04', 'henry-mosquera': 'crespo_curto|preto|5|nenhuma|nenhum|curta|2026-02' },
  vitoria: { 'lucas-arcanjo': 'crop_franja|preto|3|cheia_media|bigode|ligada|2025-09', claudinho: 'penteado_tras|cesc|1|cavanhaque|bigode_fino|curta|2022-09|conf=duvida', camutanga: 'degrade_medio|preto|1|nenhuma|nenhum|raspada|2023-03',
    riccieli: 'topete|cesc|1|cheia_curta|bigode|ligada|2021-10', edenilson: 'crespo_curto|preto|4|nenhuma|nenhum|curta|2026-03', ronald: 'degrade_medio|preto|2|nenhuma|nenhum|raspada|-|conf=pendente',
    'gabriel-baralhas': 'crop_franja|preto|2|cavanhaque|bigode|raspada|2025-09', matheuzinho: 'cacheado_degrade|preto|2|nenhuma|bigode_fino|raspada|2026-08', osvaldo: 'social_risca|preto|2|nenhuma|nenhum|curta|2023-04',
    'renato-kayzer': 'degrade_medio|cclaro|1|nenhuma|nenhum|raspada|2020-09', fabri: 'cacheado_medio|preto|4|cavanhaque|bigode|curta|2023-12' },
};
export const SKIN_HEX = ['#f6d0a8', '#e8b88a', '#c68642', '#a0693a', '#7a4a2a', '#53341f'];   // mesmos tons de SKINS (js/athlete.js)
const HAIR_KEYS = ['preto', 'cesc', 'cast', 'cclaro', 'loiro', 'ruivo', 'grisalho', 'plat'], HAIR_HEX = ['#15110e', '#2b1d12', '#4a3020', '#7a5230', '#c9a45c', '#a6401e', '#9aa0a6', '#e8d9b0'];
// penteado novo → o mais parecido dos 7 do renderizador 2D (bald|buzz|short|curly|long|afro|bun)
export const HAIR_BASE = { careca: 'bald', raspado_entradas: 'buzz', rente: 'buzz', crespo_curto: 'buzz', trancas_nago: 'buzz', black_power: 'afro', cacheado_degrade: 'curly', cacheado_medio: 'curly', twists: 'curly', longo_ombros: 'long', liso_desfiado: 'long', coque_alto: 'bun' };
export const BEARD_BASE = { nenhuma: 'none', por_fazer: 'stubble', cavanhaque: 'short', queixo: 'short', cheia_curta: 'short', cheia_media: 'full', densa: 'full', longa: 'full' };
export const hairBase = h => HAIR_BASE[h] || (['bald', 'buzz', 'short', 'curly', 'long', 'afro', 'bun'].includes(h) ? h : 'short');
const hexMix = (a, b, t) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v)*t).toString(16).padStart(2, '0')).join(''); };
export const skinHex = t => { const i = Math.max(0, Math.min(4, Math.floor(t))); return hexMix(SKIN_HEX[i], SKIN_HEX[i + 1], Math.max(0, Math.min(1, t - i))); };   // tom contínuo entre os 6 da paleta
const colorOf = k => HAIR_HEX[Math.max(0, HAIR_KEYS.indexOf(k))];
function expand(club, slug, row) {
  const [hair, cor, pele, beard, mustache, sideburn, foto, extra = ''] = row.split('|'), X = Object.fromEntries(extra.split(';').filter(Boolean).map(kv => kv.split('='))), id = `${club}-${slug}`;
  const skinT = Math.max(0, Math.min(5, +pele + (hash('pele|' + id) % 1000/1000 - .5)*.5));   // cada jogador com o seu tom (±0,25 em volta do índice observado)
  const o = { skinI: Math.round(skinT), skinT: +skinT.toFixed(2), skinHex: skinHex(skinT), hairI: Math.max(0, HAIR_KEYS.indexOf(cor)), hairHex: colorOf(cor), hair, beard, mustache, sideburn, foto: foto === '-' ? null : foto, basis: X.conf === 'pendente' ? 'pendente' : 'foto', conf: X.conf || 'ok' };
  if (X.c2) o.hairC2 = colorOf(X.c2); if (X.bc) o.beardC = colorOf(X.bc); if (X.hl) { o.hl = colorOf(X.hl); o.hlAmt = +(X.ha || 0); } if (X.tp) o.tips = +X.tp; if (X.gr) o.grey = +X.gr; if (X.bd) o.band = X.bd;
  return [id, o];
}
const hash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export const APPEARANCE_OVERRIDES = Object.fromEntries(Object.entries(REAL).flatMap(([club, rows]) => Object.entries(rows).map(([slug, row]) => expand(club, slug, row))));
const rng = seed => { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0)/4294967296; }; };
const pick = (r, table) => { let x = r()*table.reduce((s, [, w]) => s + w, 0); for (const [v, w] of table) { x -= w; if (x <= 0) return v; } return table[0][0]; };
const SKIN_W = [[0, .1], [1, .2], [2, .22], [3, .22], [4, .15], [5, .11]];
const HAIR_W = [['short', .4], ['buzz', .27], ['curly', .15], ['bald', .06], ['long', .03], ['afro', .07], ['bun', .02]];
const BEARD_W = [['none', .42], ['stubble', .2], ['short', .18], ['full', .13], ['mustache', .07]];
export function appearanceOf(id, posCode = 'CM', overrides = APPEARANCE_OVERRIDES) {
  const r = rng(hash('ap|' + id)), skinI = pick(r, SKIN_W); let hair = pick(r, HAIR_W); if (skinI >= 4 && (hair === 'long' || hair === 'bun')) hair = pick(r, [['buzz', 1], ['short', 1], ['afro', 1]]);
  const hairI = skinI >= 4 ? (r() < .9 ? 0 : 1) : skinI >= 2 ? pick(r, [[0, .4], [1, .35], [2, .2], [3, .05]]) : pick(r, [[0, .2], [1, .25], [2, .25], [3, .15], [4, .1], [5, .05]]),
    gk = posCode === 'GK', beard = pick(r, BEARD_W), build = +(.95 + r()*.1).toFixed(3), height = +((gk ? 1.02 : .97) + r()*.06).toFixed(3);
  const ap = { skinI, hairI, hair, beard, build, height, basis: 'estimado', ...(overrides[id] || {}) };
  return { ...ap, hair2d: hairBase(ap.hair), beard2d: BEARD_BASE[ap.beard] || ap.beard };   // hair2d/beard2d: versão para o renderizador 2D
}
