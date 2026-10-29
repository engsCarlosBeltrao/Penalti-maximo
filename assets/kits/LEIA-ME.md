# Camisas dos clubes (pack "Brasil Kits 26-27 / 3D")
Texturas prontas (`<clube>_<home|away|third>.jpg`, 1024x768, frente em x=256 e costas em x=768) + `kits.json` (cores de calção, meião, manga e detalhe).
Geradas por `python3 tools/build-kits.py "<pasta 3D do pack>" assets/kits` — só precisa rodar de novo se trocar o pack.
- Os rótulos clube→ID do pack foram conferidos pelo ESCUDO de cada camisa (o pack só traz números). A tabela está em `tools/build-kits.py` (CLUBS).
- Nome e número são desenhados por cima das costas em tempo real (`js/three/uniform.js → packShirt`). Goleiros usam o uniforme procedural (o pack não tem camisas de goleiro).
- Sem este diretório o jogo continua funcionando com os uniformes procedurais. Para adicionar um clube: inclua `<id>_home/away/third_3d.png` e uma linha em CLUBS.
- Teste visual (motor Three): abra `kits-demo.html` pelo Live Server.
