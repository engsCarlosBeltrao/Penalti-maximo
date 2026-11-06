// =====================================================================================================================================
// PÊNALTI MÁXIMO — FIRMWARE DO ARCADE (Arduino Uno/Nano)
// 7 botões (cima, baixo, esquerda, direita, avançar, voltar, ARCADE de chute) → eventos pela USB; o jogo manda as linhas do LCD (I2C) já prontas.
// O placar, a cobrança e tudo que aparece no LCD vêm do jogo: aqui só se lê botão e escreve texto.
// Bibliotecas: "LiquidCrystal I2C" (Frank de Brabander) pelo Gerenciador de Bibliotecas; Wire já vem com a IDE.
// Protocolo e montagem: arduino/LEIA-ME-MONTAGEM.md · pinos e LCD: config.h
// =====================================================================================================================================
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include "config.h"
#include "logica.h"
using namespace arcade;

Botao botoes[] = { { "UP", true }, { "DOWN", true }, { "LEFT", true }, { "RIGHT", true }, { "ADVANCE", false }, { "BACK", false }, { "ARCADE", false, true } };   // ARCADE: imediato (latência zero no apertar e no soltar)
const uint8_t PINOS[] = { PINO_CIMA, PINO_BAIXO, PINO_ESQUERDA, PINO_DIREITA, PINO_AVANCAR, PINO_VOLTAR, PINO_ARCADE };
const uint8_t N_BOTOES = sizeof(PINOS);
const uint8_t I_ARCADE = 6;

LiquidCrystal_I2C* lcd = nullptr;
Tela<LCD_COLUNAS, LCD_LINHAS> tela, mostrada;   // o que o jogo pediu × o que já está no display (só reescreve a linha que mudou)
Receptor rx;
uint32_t ultimaValida = 0; bool semConexao = true, jaFalou = false;
uint8_t enderecoLCD = LCD_ENDERECO;

void envia(const char* corpo) { char out[48]; if (monta(corpo, out, sizeof out)) Serial.print(out); }
void enviaHello() { char c[32]; snprintf(c, sizeof c, "HELLO|%s|%dx%d", VERSAO_FIRMWARE, LCD_COLUNAS, LCD_LINHAS); envia(c); }

void desenha() {   // escreve só as linhas diferentes (sem piscar)
  if (!lcd) return;
  for (uint8_t i = 0; i < LCD_LINHAS; i++) if (strcmp(tela.l[i], mostrada.l[i]) != 0) { lcd->setCursor(0, i); lcd->print(tela.l[i]); memcpy(mostrada.l[i], tela.l[i], LCD_COLUNAS + 1); }
}
void telaPropria(const char* a, const char* b, const char* c = "", const char* d = "") { tela.limpa(); tela.poe(0, a); tela.poe(1, b); tela.poe(2, c); tela.poe(3, d); desenha(); }

uint8_t procuraLCD() {   // varre o barramento I2C: o módulo do LCD costuma estar em 0x27 ou 0x3F
  for (uint8_t a = 0x20; a < 0x78; a++) { Wire.beginTransmission(a); if (Wire.endTransmission() == 0) return a; }
  return 0;
}

void setup() {
  for (uint8_t i = 0; i < N_BOTOES; i++) pinMode(PINOS[i], INPUT_PULLUP);
  Serial.begin(BAUD);
  Wire.begin();
  if (!enderecoLCD) enderecoLCD = procuraLCD();
  if (enderecoLCD) { lcd = new LiquidCrystal_I2C(enderecoLCD, LCD_COLUNAS, LCD_LINHAS); lcd->init(); lcd->backlight(); lcd->clear(); mostrada.limpa(); }
  char end[20]; snprintf(end, sizeof end, "LCD I2C 0x%02X", enderecoLCD);
  telaPropria("PENALTI MAXIMO", "AGUARDANDO O JOGO", end, "CONECTE NO PC");
  enviaHello();
}

void trataLinha(const char* c) {
  ultimaValida = millis(); jaFalou = true;
  if (semConexao) { semConexao = false; mostrada.limpa(); if (lcd) lcd->clear(); }
  if (!strcmp(c, "PING")) { envia("PONG"); return; }
  if (!strcmp(c, "HELLO?")) { enviaHello(); return; }
  if (c[0] == 'T' && c[1] == '|') { if (lcd) { if (c[2] == '1') lcd->backlight(); else lcd->noBacklight(); } return; }
  if (tela.deLinhaL(c) >= 0) desenha();
}

void loop() {
  const uint32_t ms = millis();
  // botões
  for (uint8_t i = 0; i < N_BOTOES; i++) {
    Evento e = botoes[i].atualiza(digitalRead(PINOS[i]) == LOW, ms, DEBOUNCE_MS, REPETE_ATRASO_MS, REPETE_INTERVALO);
    if (e == NADA) continue;
    char c[24];
    if (i == I_ARCADE) {                           // arcade: APERTOU e SOLTOU separados (o jogo enche a força enquanto está apertado)
      if (e == APERTOU) envia("ARCADE_DOWN");
      else if (e == SOLTOU) { snprintf(c, sizeof c, "ARCADE_UP|%lu", (unsigned long)(ms - botoes[i].tApertou)); envia(c); }
    } else if (e == APERTOU || e == REPETIU) { snprintf(c, sizeof c, "%s_%s", botoes[i].nome, e == APERTOU ? "PRESS" : "REPEAT"); envia(c); }
  }
  // mensagens do jogo
  while (Serial.available()) { if (rx.recebe((char)Serial.read())) trataLinha(rx.corpo()); }
  // sem conexão
  if (!semConexao && ms - ultimaValida > SEM_CONEXAO_MS) { semConexao = true; telaPropria("PENALTI MAXIMO", "SEM CONEXAO", "COM O JOGO", "VERIFIQUE O USB"); }
  static uint32_t tHello = 0;
  if (!jaFalou && ms - tHello >= 3000) { tHello = ms; enviaHello(); }     // até o jogo responder, anuncia-se a cada 3 s
}
