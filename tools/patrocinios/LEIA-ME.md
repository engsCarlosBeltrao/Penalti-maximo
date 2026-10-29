# Reparo dos patrocinios cortados (costas)
Scripts usados uma vez para refazer os logos que estavam cortados na borda de cima dos atlas `assets/kits/*.jpg`
(a imagem original ja vinha sem a parte de cima do logo). Os caminhos (/tmp/w/...) sao os da sessao de trabalho.
- Pixels reais reaproveitados de outra camisa: bmg, Lubrax, Superbet, banrisul, Ademicon, SEGURO AUTO (Corinthians), Red Bulls ASAS.
- Redesenhados (aproximacao, NAO sao os logos oficiais): Leapmotor, EZZE, Vilma, Red Bulls (texto), betnacional, Pinheiro, diadora.
- Alpha Consorcio (Vitoria): so a palavra foi mantida; o simbolo estava cortado pela metade e nao da pra reconstruir.
- Sao Paulo: sem patrocinio visivel nas costas do atlas; nao foi alterado alem de limpar um resto cortado.
- `assets/kits/kits.json` ganhou o campo `sb` (linha do atlas onde termina o patrocinio) usado por `packShirt` para pôr o nome logo abaixo.
