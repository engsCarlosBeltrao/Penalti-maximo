// Teste do FIRMWARE no PC: compila o próprio penalti_arcade.ino com imitações do Arduino (mock/) e simula botões, ruído, serial e LCD.
// g++ -std=c++17 -I mock -o teste_firmware teste_firmware.cpp && ./teste_firmware
#include "mock/mock_arduino.h"
#include "../penalti_arcade/penalti_arcade.ino"
#include <vector>
#include <iostream>
static int ok = 0, falhas = 0;
static void t(const char* nome, bool c, const std::string& info = "") { if (c) ok++; else { falhas++; std::cout << "FALHOU: " << nome << " " << info << "\n"; } }
static void corre(uint32_t ms) { for (uint32_t i = 0; i < ms; i++) { _ms++; loop(); } }
static int conta(const std::string& s, const std::string& sub) { int n = 0; for (size_t p = s.find(sub); p != std::string::npos; p = s.find(sub, p + 1)) n++; return n; }
static std::string linha(const char* corpo) { char b[160]; arcade::monta(corpo, b, sizeof b); return b; }
static std::string lcdTxt() { std::string s; for (int i = 0; i < LCD_LINHAS; i++) s += lcd->L[i] + "\n"; return s; }
int main() {
  for (int& p : _pino) p = HIGH;                                               // INPUT_PULLUP: solto = HIGH
  t("checksum igual ao do jogo (PING → 10)", linha("PING") == "PING*10\n", linha("PING"));
  setup();
  t("liga e se anuncia (HELLO)", Serial.saida.find("HELLO|1|20x4*") != std::string::npos, Serial.saida);
  t("acha o LCD no barramento I2C (0x27)", lcd && lcd->a == 0x27);
  t("tela inicial: aguardando o jogo", lcdTxt().find("AGUARDANDO O JOGO") != std::string::npos, lcdTxt());
  Serial.saida.clear();
  // direcional com repetição controlada
  _pino[PINO_CIMA] = LOW; corre(1000); _pino[PINO_CIMA] = HIGH; corre(100);
  t("CIMA: um UP_PRESS", conta(Serial.saida, "UP_PRESS*") == 1, Serial.saida);
  int rep = conta(Serial.saida, "UP_REPEAT*"); t("CIMA segurado 1 s: repete 3–4 vezes (450 ms + a cada 180 ms)", rep >= 3 && rep <= 4, std::to_string(rep));
  Serial.saida.clear();
  // ruído mecânico: contato quicando por 20 ms antes de firmar
  for (int k = 0; k < 4; k++) { _pino[PINO_AVANCAR] = k % 2 ? HIGH : LOW; corre(5); } _pino[PINO_AVANCAR] = LOW; corre(60); _pino[PINO_AVANCAR] = HIGH; for (int k = 0; k < 4; k++) { _pino[PINO_AVANCAR] = k % 2 ? LOW : HIGH; corre(4); } _pino[PINO_AVANCAR] = HIGH; corre(60);
  t("AVANÇAR com ruído: exatamente um ADVANCE_PRESS (debounce)", conta(Serial.saida, "ADVANCE_PRESS*") == 1, Serial.saida);
  t("AVANÇAR não repete", conta(Serial.saida, "ADVANCE_REPEAT") == 0);
  Serial.saida.clear();
  // arcade: apertar e soltar são eventos separados, com o tempo segurado
  _pino[PINO_ARCADE] = LOW; corre(620); t("ARCADE: ARCADE_DOWN ao apertar (antes de soltar)", conta(Serial.saida, "ARCADE_DOWN*") == 1 && conta(Serial.saida, "ARCADE_UP") == 0, Serial.saida);
  _pino[PINO_ARCADE] = HIGH; corre(60);
  t("ARCADE: um ARCADE_UP ao soltar", conta(Serial.saida, "ARCADE_UP|") == 1, Serial.saida);
  { size_t p = Serial.saida.find("ARCADE_UP|"); int msS = atoi(Serial.saida.c_str() + p + 10); t("ARCADE_UP traz o tempo segurado (~620 ms)", msS >= 600 && msS <= 640, std::to_string(msS)); }
  t("ARCADE nunca gera PRESS/REPEAT", conta(Serial.saida, "ARCADE_PRESS") + conta(Serial.saida, "ARCADE_REPEAT") == 0);
  // ARCADE sem atraso e com contato quicando: DOWN no 1º ms do contato, UP no 1º ms da soltura, um de cada, duração exata
  for (uint32_t segurar : { 80u, 300u, 700u, 1200u, 1700u }) {
    Serial.saida.clear(); corre(100);
    _pino[PINO_ARCADE] = LOW; _ms++; loop(); bool desceuNaHora = Serial.saida.find("ARCADE_DOWN*") != std::string::npos;
    for (int k = 0; k < 6; k++) { _pino[PINO_ARCADE] = k % 2 ? LOW : HIGH; corre(2); } _pino[PINO_ARCADE] = LOW;   // quique de 12 ms
    corre(segurar - 13);
    _pino[PINO_ARCADE] = HIGH; _ms++; loop(); bool subiuNaHora = Serial.saida.find("ARCADE_UP|") != std::string::npos;
    for (int k = 0; k < 6; k++) { _pino[PINO_ARCADE] = k % 2 ? HIGH : LOW; corre(2); } _pino[PINO_ARCADE] = HIGH; corre(60);
    size_t p = Serial.saida.find("ARCADE_UP|"); int msS = p == std::string::npos ? -1 : atoi(Serial.saida.c_str() + p + 10);
    t(("ARCADE " + std::to_string(segurar) + " ms com quique: DOWN e UP na hora, um de cada, tempo exato (" + std::to_string(msS) + " ms)").c_str(),
      desceuNaHora && subiuNaHora && conta(Serial.saida, "ARCADE_DOWN*") == 1 && conta(Serial.saida, "ARCADE_UP|") == 1 && msS == (int)segurar, Serial.saida);
  }
  Serial.saida.clear();
  // mensagens do jogo
  Serial.manda(linha("PING")); corre(2); t("responde PING com PONG", Serial.saida.find("PONG*") != std::string::npos, Serial.saida);
  Serial.manda("PING*FF\n"); Serial.saida.clear(); corre(2); t("checksum errado: ignora", Serial.saida.find("PONG") == std::string::npos && rx.invalidas >= 1);
  Serial.manda(std::string(300, 'X')); Serial.manda("\n"); Serial.manda(linha("PING")); Serial.saida.clear(); corre(5);
  t("lixo longo sem quebra de linha não trava: a próxima linha válida funciona", Serial.saida.find("PONG*") != std::string::npos);
  Serial.manda(std::string("PI\x01NG*10\n")); Serial.saida.clear(); corre(2); t("caractere inválido: linha descartada", Serial.saida.find("PONG") == std::string::npos);
  Serial.manda(linha("L|FLAMENGO x VASCO|PLACAR: 2 x 1|COBRANCA: 4/5|BATENDO: VASCO")); corre(2);
  t("LCD mostra as linhas do jogo", lcd->L[0].rfind("FLAMENGO x VASCO", 0) == 0 && lcd->L[1].rfind("PLACAR: 2 x 1", 0) == 0 && lcd->L[3].rfind("BATENDO: VASCO", 0) == 0, lcdTxt());
  Serial.manda(linha("L|FLAMENGO x VASCO|PLACAR: 3 x 1|COBRANCA: 4/5|BATENDO: VASCO")); corre(2); t("placar muda no LCD", lcd->L[1].rfind("PLACAR: 3 x 1", 0) == 0);
  Serial.manda(linha("L|UMA LINHA MUITO MAIS LONGA QUE O DISPLAY")); corre(2); t("linha longa é cortada no tamanho do LCD; as outras ficam em branco", lcd->L[0] == std::string("UMA LINHA MUITO MAIS") && lcd->L[1] == std::string(20, ' '), lcdTxt());
  Serial.manda(linha("HELLO?")); Serial.saida.clear(); corre(2); t("HELLO? → HELLO com o tamanho do LCD", Serial.saida.find("HELLO|1|20x4") != std::string::npos);
  // queda
  corre(SEM_CONEXAO_MS + 50); t("sem mensagens por 6 s: SEM CONEXAO no LCD", lcdTxt().find("SEM CONEXAO") != std::string::npos, lcdTxt());
  Serial.manda(linha("L|DE VOLTA|")); corre(2); t("voltou a receber: mostra o jogo de novo", lcd->L[0].rfind("DE VOLTA", 0) == 0, lcdTxt());
  // botões continuam funcionando sem conexão
  corre(SEM_CONEXAO_MS + 50); Serial.saida.clear(); _pino[PINO_VOLTAR] = LOW; corre(40); _pino[PINO_VOLTAR] = HIGH; corre(40);
  t("botões funcionam mesmo sem conexão (o jogo reconecta e recebe)", conta(Serial.saida, "BACK_PRESS*") == 1);
  // todas as linhas enviadas são válidas pelo próprio receptor
  { arcade::Receptor r2; int boas = 0, total = 0; for (char c : Serial.saida) { if (c == '\n') total++; if (r2.recebe(c)) boas++; } t("tudo que o Arduino envia tem checksum válido", total > 0 && boas == total); }
  std::cout << "FIRMWARE OK " << ok << " | FALHAS " << falhas << "\n"; return falhas ? 1 : 0;
}
