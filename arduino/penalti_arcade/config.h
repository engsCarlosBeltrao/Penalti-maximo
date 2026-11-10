// =====================================================================================================================================
// CONFIGURAÇÃO DO ARCADE — confira e ajuste ANTES de montar/enviar (é o único arquivo que normalmente precisa mudar)
// =====================================================================================================================================
#pragma once

// ---- Botões: um terminal no pino, o outro no GND. Usa INPUT_PULLUP (resistor interno): apertado = LOW. Nenhum resistor externo é necessário.
// Pinos digitais livres no Uno/Nano: D2..D13 (D0/D1 são a serial USB; A4/A5 são o I2C do LCD). Troque à vontade aqui.
#define PINO_CIMA      2
#define PINO_BAIXO     3
#define PINO_ESQUERDA  4
#define PINO_DIREITA   5
#define PINO_PAUSA     6      // AVANÇAR / PAUSA (confirma nos menus, pausa na partida)
#define PINO_DESPAUSA  7      // VOLTAR / DESPAUSA (volta nos menus, despausa na partida)
#define PINO_ARCADE    8      // botão grande de chute
// Os pinos acima são só o PADRÃO de fábrica. O jeito fácil é ligar os botões em QUALQUER um dos pinos abaixo e usar no jogo
// ARCADE / ARDUINO → CONFIGURAR BOTÕES: você aperta cada botão quando o jogo pedir e o mapa fica gravado na EEPROM do Arduino.
// Pinos lidos (todos com INPUT_PULLUP): D2..D12 e A0..A3. Fora da lista: D0/D1 (USB), D13 (LED da placa), A4/A5 (I2C do LCD).
#define PINOS_CANDIDATOS  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, A0, A1, A2, A3

// ---- LCD com módulo I2C (PCF8574). SDA = A4 e SCL = A5 no Uno/Nano (no Mega: SDA 20, SCL 21).
// Endereço: os módulos vêm como 0x27 ou 0x3F. Deixe 0 para o firmware PROCURAR sozinho no barramento ao ligar (e mostrar qual achou).
#define LCD_ENDERECO   0
#define LCD_COLUNAS    20     // 16 para LCD 16x2
#define LCD_LINHAS     4      // 2  para LCD 16x2

// ---- Tempos (ms)
#define DEBOUNCE_MS        25     // o contato precisa ficar estável este tempo para valer (ruído mecânico)
#define REPETE_ATRASO_MS   450    // direcional segurado: começa a repetir depois deste tempo…
#define REPETE_INTERVALO   180    // …e repete neste intervalo
#define SEM_CONEXAO_MS     6000   // sem nenhuma mensagem válida do jogo por este tempo → "SEM CONEXAO" no LCD
#define BAUD               115200

#define VERSAO_FIRMWARE    "2"      // 2 = botões configuráveis pelo jogo (mapa na EEPROM), PAUSA e DESPAUSA
