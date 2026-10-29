// 20 clubes brasileiros: cores e padrões de uniforme ESTILIZADOS (não são réplicas oficiais).
// Escudos: coloque PNGs em assets/crests/<key>.png (ex.: flamengo.png). Sem arquivo, aparece um selo neutro com a sigla.
export const TEAMS = [
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
export const CRESTS = [];
