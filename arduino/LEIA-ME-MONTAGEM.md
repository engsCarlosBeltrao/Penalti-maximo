# Arcade do PÊNALTI MÁXIMO (Arduino + botões + LCD)

O Arduino lê 7 botões e manda os eventos pelo USB. O jogo, aberto no navegador, executa esses eventos pelos mesmos caminhos do teclado e do mouse, e manda de volta o texto pronto do LCD. O placar e a cobrança vêm sempre do jogo: o Arduino não calcula nada. Sem Arduino, o jogo funciona normalmente.

## 1. Componentes

| Qtd | Item | Observação |
|---|---|---|
| 1 | Arduino **Uno** ou **Nano** (ATmega328P) | O firmware usa 9,1 KB de 32 KB e 53% da RAM. Um Mega também serve (o I2C fica em SDA 20 / SCL 21). |
| 1 | Cabo USB do Arduino | Alimenta a placa e leva os dados. Não precisa de fonte externa. |
| 1 | LCD **20x4** ou **16x2** com módulo **I2C** (PCF8574) atrás | São só 4 fios. O endereço costuma ser 0x27 ou 0x3F, e o firmware procura sozinho. |
| 6 | Botões arcade pequenos ou microchaves | cima, baixo, esquerda, direita, avançar, voltar |
| 1 | Botão arcade grande | chute |
| — | Fios (jumper ou cabo fino), conectores de botão arcade (fast-on 4,8 mm) | — |

**Não precisa de resistor:** o firmware usa o `INPUT_PULLUP`, que é o resistor interno do Arduino.

## 2. Pinos

Esses são os pinos **padrão**. Você não precisa seguir esta tabela: ligue cada botão em qualquer pino livre (D2 a D12 ou A0 a A3) e depois configure pelo jogo, como no item **Configurar os botões** abaixo. (Também dá para trocar o padrão em `penalti_arcade/config.h`.)

| Função | Pino | Ligação |
|---|---|---|
| CIMA | D2 | um terminal no pino, o outro no GND |
| BAIXO | D3 | idem |
| ESQUERDA | D4 | idem |
| DIREITA | D5 | idem |
| AVANÇAR / PAUSA | D6 | idem |
| VOLTAR / DESPAUSA | D7 | idem |
| ARCADE (chute) | D8 | idem |
| LCD SDA | A4 | no Nano também é A4 |
| LCD SCL | A5 | no Nano também é A5 |
| LCD VCC / GND | 5V / GND | — |

Não use D0 e D1 (serial USB), D13 (LED da placa) nem A4/A5 (LCD).

### Configurar os botões (firmware 2)

1. Grave o firmware novo: `enviar.bat` (ele aparece no jogo como **firmware 2**).
2. No jogo: **ARCADE / ARDUINO → CONECTAR** e depois **CONFIGURAR BOTÕES**.
3. O jogo (e o LCD) pede um botão de cada vez: **CIMA, BAIXO, ESQUERDA, DIREITA, PAUSA, DESPAUSA e ARCADE**. Aperte no arcade o botão que você quer para cada um.
4. Se apertar um botão que já foi usado, o jogo avisa e espera outro. **VOLTAR UM PASSO** desfaz o último; **CANCELAR** sai sem gravar nada.
5. No 7º botão o mapa é gravado na **EEPROM do Arduino** e passa a valer na hora. Ele continua lá depois de desligar a placa e em qualquer PC.

Durante a configuração os botões não mexem no jogo nem nos menus. Se o cabo cair no meio, nada é gravado.

```
            ARDUINO UNO / NANO
           ┌───────────────────┐
  CIMA ────┤ D2            A4  ├──── SDA ┐
  BAIXO ───┤ D3            A5  ├──── SCL ├── módulo I2C do LCD
  ESQ. ────┤ D4            5V  ├──── VCC │
  DIR. ────┤ D5           GND  ├──── GND ┘
  AVANÇAR ─┤ D6  (e PAUSA)     │
  VOLTAR ──┤ D7  (e DESPAUSA)  │
  ARCADE ──┤ D8           GND  ├──┬── 2º terminal de TODOS os botões (GND comum)
           └────────┬──────────┘  │
                  USB → PC        └── (pode ser um barramento de GND na caixa)
```

Botão arcade com microchave de 3 terminais: use **COM** (comum) no GND e **NO** (normalmente aberto) no pino. Deixe o **NC** livre.

## 3. Antes de montar, confirme

1. **Tamanho do LCD.** Ajuste `LCD_COLUNAS`/`LCD_LINHAS` em `config.h`: 20/4 ou 16/2. O jogo se adapta sozinho ao que o Arduino informa. No 16x2, as telas maiores alternam em páginas a cada 2,5 s.
2. **Endereço I2C.** Deixe `LCD_ENDERECO 0` e o firmware procura sozinho. O endereço encontrado aparece no próprio LCD ao ligar ("LCD I2C 0x27").
3. **Contraste.** Se o LCD acender mas não mostrar texto, gire o trimpot azul atrás do módulo I2C.
4. **Placa.** Uno ou Nano. Para Nano clone com chip CH340, use "Nano (old bootloader)" ou `enviar.bat COMx nano-antigo`.
5. **Pinos.** Se usar outros, mude só em `config.h`.

## 4. Instalar, compilar e enviar

**Pelo Arduino IDE 2:**
1. Abra `arduino/penalti_arcade/penalti_arcade.ino`.
2. Em *Ferramentas → Gerenciar bibliotecas*, instale **"LiquidCrystal I2C"** (Frank de Brabander). Neste PC ela já foi instalada.
3. Escolha *Ferramentas → Placa → Arduino Uno* (ou *Arduino Nano*) e a *Porta* COM.
4. Clique em **Carregar** (→).

**Por um clique:** rode `arduino/enviar.bat`. Ele usa o compilador que vem dentro do Arduino IDE, instala o que faltar, compila e envia para a placa encontrada.
- Com porta fixa: `enviar.bat COM5`.
- Para Nano: `enviar.bat COM5 nano`.

Feche o Monitor Serial do IDE e a tela ARCADE do jogo antes de enviar, porque só um programa pode usar a porta por vez.

## 5. Conectar ao jogo

1. Abra o jogo pelo `iniciar.bat`. Ele abre em `http://127.0.0.1`, que é exigido pela Web Serial.
2. Use **Google Chrome** ou **Microsoft Edge** no computador. Firefox e Safari não têm Web Serial: neles o jogo funciona com teclado e mouse, e a tela ARCADE avisa.
3. No menu principal, entre em **ARCADE / ARDUINO** → **CONECTAR (escolher porta)** e escolha a porta do Arduino na lista do navegador. A primeira vez precisa de um clique de mouse: o navegador só mostra a lista assim.
4. Depois disso a porta fica autorizada. Se o cabo sair, o jogo tenta reconectar sozinho a cada 3 s e a partida não trava.
5. A tela ARCADE mostra:
   - o estado da ligação;
   - os botões acendendo quando apertados;
   - o que o LCD está recebendo;
   - o registro dos comandos;
   - o botão **TESTAR LCD**;
   - o **SIMULADOR**, que tem botões na tela para testar tudo sem hardware.

## 6. O que cada botão faz

| Botão | Nos menus | Na partida |
|---|---|---|
| Direcionais | movem a seleção; em controles deslizantes e listas, ← → mudam o valor | defendendo: escolhem o canto do goleiro (← canto esquerdo da tela, → direito, ↑/↓ centro), antes do limite de 1,5 s |
| AVANÇAR / PAUSA | confirma o item selecionado | **pausa** (bola, jogadores e cronômetro param); no menu de pausa, confirma o item em foco |
| VOLTAR / DESPAUSA | volta à tela anterior | no menu de pausa, **volta ao jogo** de onde parou. Sair da partida: no menu de pausa, **SAIR DA PARTIDA → SIM, SAIR** com as setas e o ARCADE |
| ARCADE | confirma o item selecionado (também no menu de pausa) | **apertar** começa a encher a força (a mesma barra do mouse); **soltar** chuta com a força daquele instante. Toque rápido = chapada (fraca), ~0,7 s = médio, ~1,2 s = bomba (forte). Um aperto = no máximo uma cobrança. |

Como no mouse, um aperto antes de o cobrador chegar à bola não vale: solte e aperte de novo quando a mira aparecer. Assim a força é sempre o tempo real em que o botão ficou apertado.

Teclado: **P** ou **Esc** também pausam.

## 7. Protocolo (USB serial, 115200 baud)

Cada mensagem é uma linha de texto ASCII que termina em `*HH`. HH é o XOR de todos os bytes do conteúdo, em hexadecimal. Linhas com checksum errado, caracteres inválidos ou longas demais são descartadas dos dois lados. A especificação completa está em `js/hardware/protocolo.js`.

| Direção | Mensagens |
|---|---|
| Arduino → jogo | `HELLO\|2\|20x4` · `UP_PRESS` `DOWN_PRESS` `LEFT_PRESS` `RIGHT_PRESS` · `UP_REPEAT`… (direcional segurado: começa após 450 ms, a cada 180 ms) · `PAUSE_PRESS` · `RESUME_PRESS` · `ARCADE_DOWN` · `ARCADE_UP\|ms` · `PONG` · `MAPA\|2,3,4,5,6,7,8` · `MAPA_ERRO\|motivo` · `APRENDER\|0/1` · `PINO\|n` (só no modo de configuração). O firmware 1 mandava `ADVANCE_PRESS`/`BACK_PRESS`, que o jogo ainda aceita. |
| Jogo → Arduino | `HELLO?` · `PING` (a cada 2 s) · `L\|linha1\|linha2\|linha3\|linha4` (o texto do LCD) · `T\|0/1` (luz de fundo) · `MAPA?` · `MAPA\|a,b,c,d,e,f,g` (grava na EEPROM) · `MAPA\|PADRAO` · `APRENDER\|1` / `APRENDER\|0` |

O jogo só manda o LCD quando a tela muda: troca de time, de cobrança, placar, resultado, pausa ou fim. No 16x2 também manda quando a página alterna. Se o Arduino ficar 6 s sem receber nada válido, mostra **SEM CONEXAO** no LCD e continua mandando os botões.

## 8. Arquivos

| Arquivo | Papel |
|---|---|
| `arduino/penalti_arcade/penalti_arcade.ino` | firmware: botões, serial, LCD |
| `arduino/penalti_arcade/config.h` | pinos, LCD e tempos |
| `arduino/penalti_arcade/logica.h` | debounce, repetição, protocolo, tela; C++ puro, também compila no PC |
| `arduino/teste_host/` | teste do firmware no PC (g++ com imitações do Arduino) |
| `arduino/enviar.bat` | compila e envia pelo arduino-cli do Arduino IDE |
| `js/arduino.js` | integração: junta ligação, botões, menus e LCD |
| `js/hardware/protocolo.js` | protocolo e checksum |
| `js/hardware/serial.js` | Web Serial, saúde da ligação (PING/PONG), queda e reconexão |
| `js/hardware/comandos.js` | o que cada botão faz em cada momento (chute, pausa, goleiro, menus) |
| `js/hardware/navegacao.js` | foco espacial nos menus existentes |
| `js/hardware/lcd.js` | telas do LCD a partir dos dados oficiais da partida |
| `js/hardware/simulador.js` | Arduino simulado (testes e tela ARCADE) |
| `js/hardware/painel.js` | tela ARCADE / ARDUINO |

## 9. Testes

| Comando | O que testa |
|---|---|
| `node test_arduino.mjs` | protocolo, navegação, telas do LCD e a partida inteira pelo simulador (os 16 casos pedidos) |
| `node tools/teste-firmware.mjs` | o firmware no PC (debounce com ruído, repetição, ARCADE_DOWN/UP com tempo, checksum, lixo na serial, LCD, SEM CONEXAO) e a compilação real para Uno e Nano |
