// =====================================================================================================================================
// PÊNALTI MÁXIMO — FIRMWARE DO ARCADE (Arduino Uno/Nano) — versão 2
// 7 funções: cima, baixo, esquerda, direita, PAUSA, DESPAUSA e o ARCADE de chute → eventos pela USB; o jogo manda as linhas do LCD (I2C) já prontas.
// BOTÕES CONFIGURÁVEIS: o firmware lê todos os pinos livres (config.h, PINOS_CANDIDATOS). Qual pino é qual função fica num MAPA gravado na
// EEPROM, que o jogo configura (ARCADE / ARDUINO → CONFIGURAR BOTÕES): no modo "aprender" cada aperto manda "PINO|<n>" em vez do comando.
// O placar, a cobrança e tudo que aparece no LCD vêm do jogo: aqui só se lê botão e escreve texto.
// Bibliotecas: "LiquidCrystal I2C" (Frank de Brabander) pelo Gerenciador de Bibliotecas; Wire e EEPROM já vêm com a IDE.
// Protocolo e montagem: arduino/LEIA-ME-MONTAGEM.md · pinos padrão e LCD: config.h
// =====================================================================================================================================
#include <Wire.h>
#include <EEPROM.h>
#include <LiquidCrystal_I2C.h>
#include "config.h"
#include "logica.h"
using namespace arcade;

const uint8_t CANDIDATOS[] = { PINOS_CANDIDATOS };
const uint8_t N_CAND = sizeof(CANDIDATOS);
const uint8_t MAPA_PADRAO[N_FUNCOES] = { PINO_CIMA, PINO_BAIXO, PINO_ESQUERDA, PINO_DIREITA, PINO_PAUSA, PINO_DESPAUSA, PINO_ARCADE };
uint8_t mapa[N_FUNCOES];                // pino de cada função
int8_t funcaoDe[N_CAND];                // função de cada pino lido (-1 = sem função)
Botao botoes[N_CAND];
bool aprendendo = false;                // modo de configuração: aperto → "PINO|<n>"

LiquidCrystal_I2C* lcd = nullptr;
Tela<LCD_COLUNAS, LCD_LINHAS> tela, mostrada;   // o que o jogo pediu × o que já está no display (só reescreve a linha que mudou)
Receptor rx;
uint32_t ultimaValida = 0; bool semConexao = true, jaFalou = false;
uint8_t enderecoLCD = LCD_ENDERECO;

void envia(const char* corpo) { char out[48]; if (monta(corpo, out, sizeof out)) Serial.print(out); }
void enviaHello() { char c[32]; snprintf(c, sizeof c, "HELLO|%s|%dx%d", VERSAO_FIRMWARE, LCD_COLUNAS, LCD_LINHAS); envia(c); }
void enviaMapa() { char c[40]; escreveMapa(mapa, c, sizeof c); envia(c); }

// liga cada pino lido à sua função: direcionais repetem quando segurados; o ARCADE vale no primeiro contato (latência zero)
void aplicaMapa() {
  const uint32_t ms = millis();
  for (uint8_t i = 0; i < N_CAND; i++) {
    int8_t f = -1; for (uint8_t k = 0; k < N_FUNCOES; k++) if (mapa[k] == CANDIDATOS[i]) f = (int8_t)k;
    funcaoDe[i] = f; Botao& b = botoes[i];
    b.nome = f >= 0 ? NOME_FUNCAO[f] : nullptr; b.repete = f >= F_CIMA && f <= F_DIREITA; b.imediato = f == F_ARCADE;
    b.estavel = b.bruto = digitalRead(CANDIDATOS[i]) == LOW; b.tMuda = ms;   // botão já apertado durante a troca não vira evento falso
  }
}
void carregaMapa() {
  uint8_t ee[EE_TAM]; for (uint8_t i = 0; i < EE_TAM; i++) ee[i] = EEPROM.read(i);
  if (!desempacotaEE(ee, mapa) || !mapaValido(mapa, CANDIDATOS, N_CAND)) memcpy(mapa, MAPA_PADRAO, N_FUNCOES);
}
void gravaMapa() { uint8_t ee[EE_TAM]; empacotaEE(mapa, ee); for (uint8_t i = 0; i < EE_TAM; i++) EEPROM.update(i, ee[i]); }   // update: só escreve o byte que mudou

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
  for (uint8_t i = 0; i < N_CAND; i++) pinMode(CANDIDATOS[i], INPUT_PULLUP);
  carregaMapa(); aplicaMapa(); aprendendo = false;
  Serial.begin(BAUD);
  Wire.begin();
  if (!enderecoLCD) enderecoLCD = procuraLCD();
  if (enderecoLCD) { lcd = new LiquidCrystal_I2C(enderecoLCD, LCD_COLUNAS, LCD_LINHAS); lcd->init(); lcd->backlight(); lcd->clear(); mostrada.limpa(); }
  char end[20]; snprintf(end, sizeof end, "LCD I2C 0x%02X", enderecoLCD);
  telaPropria("PENALTI MAXIMO", "AGUARDANDO O JOGO", end, "CONECTE NO PC");
  enviaHello();
}

// entra/sai do modo aprender; o ARCADE segurado na entrada é solto (o jogo nunca fica com a força enchendo)
void modoAprender(bool on) {
  if (on && !aprendendo) for (uint8_t i = 0; i < N_CAND; i++) if (funcaoDe[i] == F_ARCADE && botoes[i].estavel) { char c[24]; snprintf(c, sizeof c, "ARCADE_UP|%lu", (unsigned long)botoes[i].segurado(millis())); envia(c); }
  aprendendo = on; envia(on ? "APRENDER|1" : "APRENDER|0");
}

void trataLinha(const char* c) {
  ultimaValida = millis(); jaFalou = true;
  if (semConexao) { semConexao = false; mostrada.limpa(); if (lcd) lcd->clear(); }
  if (!strcmp(c, "PING")) { envia("PONG"); return; }
  if (!strcmp(c, "HELLO?")) { enviaHello(); return; }
  if (!strcmp(c, "MAPA?")) { enviaMapa(); return; }
  if (!strcmp(c, "APRENDER|1")) { modoAprender(true); return; }
  if (!strcmp(c, "APRENDER|0")) { modoAprender(false); return; }
  if (!strcmp(c, "MAPA|PADRAO")) { memcpy(mapa, MAPA_PADRAO, N_FUNCOES); gravaMapa(); aplicaMapa(); enviaMapa(); return; }
  if (!strncmp(c, "MAPA|", 5)) {                     // novo mapa vindo do jogo: confere, grava na EEPROM e passa a valer na hora
    uint8_t m[N_FUNCOES];
    if (!leMapa(c, m)) { envia("MAPA_ERRO|FORMATO"); return; }
    if (!mapaValido(m, CANDIDATOS, N_CAND)) { envia("MAPA_ERRO|PINO INVALIDO OU REPETIDO"); return; }
    memcpy(mapa, m, N_FUNCOES); gravaMapa(); aplicaMapa(); enviaMapa(); return;
  }
  if (c[0] == 'T' && c[1] == '|') { if (lcd) { if (c[2] == '1') lcd->backlight(); else lcd->noBacklight(); } return; }
  if (tela.deLinhaL(c) >= 0) desenha();
}

void loop() {
  const uint32_t ms = millis();
  // botões
  for (uint8_t i = 0; i < N_CAND; i++) {
    Evento e = botoes[i].atualiza(digitalRead(CANDIDATOS[i]) == LOW, ms, DEBOUNCE_MS, REPETE_ATRASO_MS, REPETE_INTERVALO);
    if (e == NADA) continue;
    char c[24];
    if (aprendendo) { if (e == APERTOU) { snprintf(c, sizeof c, "PINO|%u", CANDIDATOS[i]); envia(c); } continue; }   // configurando: só diz qual pino foi
    const int8_t f = funcaoDe[i]; if (f < 0) continue;                                                              // pino sem função: ignora
    if (f == F_ARCADE) {                           // arcade: APERTOU e SOLTOU separados (o jogo enche a força enquanto está apertado)
      if (e == APERTOU) envia("ARCADE_DOWN");
      else if (e == SOLTOU) { snprintf(c, sizeof c, "ARCADE_UP|%lu", (unsigned long)(ms - botoes[i].tApertou)); envia(c); }
    } else if (e == APERTOU || e == REPETIU) { snprintf(c, sizeof c, "%s_%s", botoes[i].nome, e == APERTOU ? "PRESS" : "REPEAT"); envia(c); }
  }
  // mensagens do jogo
  while (Serial.available()) { if (rx.recebe((char)Serial.read())) trataLinha(rx.corpo()); }
  // sem conexão (sai do modo aprender: o jogo que pediu não está mais lá)
  if (!semConexao && ms - ultimaValida > SEM_CONEXAO_MS) { semConexao = true; aprendendo = false; telaPropria("PENALTI MAXIMO", "SEM CONEXAO", "COM O JOGO", "VERIFIQUE O USB"); }
  static uint32_t tHello = 0;
  if (!jaFalou && ms - tHello >= 3000) { tHello = ms; enviaHello(); }     // até o jogo responder, anuncia-se a cada 3 s
}
