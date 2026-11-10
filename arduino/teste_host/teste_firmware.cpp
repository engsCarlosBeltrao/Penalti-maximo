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
  t("liga e se anuncia (HELLO)", Serial.saida.find("HELLO|2|20x4*") != std::string::npos, Serial.saida);
  t("acha o LCD no barramento I2C (0x27)", lcd && lcd->a == 0x27);
  t("tela inicial: aguardando o jogo", lcdTxt().find("AGUARDANDO O JOGO") != std::string::npos, lcdTxt());
  Serial.saida.clear();
  // direcional com repetição controlada
  _pino[PINO_CIMA] = LOW; corre(1000); _pino[PINO_CIMA] = HIGH; corre(100);
  t("CIMA: um UP_PRESS", conta(Serial.saida, "UP_PRESS*") == 1, Serial.saida);
  int rep = conta(Serial.saida, "UP_REPEAT*"); t("CIMA segurado 1 s: repete 3–4 vezes (450 ms + a cada 180 ms)", rep >= 3 && rep <= 4, std::to_string(rep));
  Serial.saida.clear();
  // ruído mecânico: contato quicando por 20 ms antes de firmar
  for (int k = 0; k < 4; k++) { _pino[PINO_PAUSA] = k % 2 ? HIGH : LOW; corre(5); } _pino[PINO_PAUSA] = LOW; corre(60); _pino[PINO_PAUSA] = HIGH; for (int k = 0; k < 4; k++) { _pino[PINO_PAUSA] = k % 2 ? LOW : HIGH; corre(4); } _pino[PINO_PAUSA] = HIGH; corre(60);
  t("PAUSA com ruído: exatamente um PAUSE_PRESS (debounce)", conta(Serial.saida, "PAUSE_PRESS*") == 1, Serial.saida);
  t("PAUSA não repete", conta(Serial.saida, "PAUSE_REPEAT") == 0);
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
  Serial.manda(linha("HELLO?")); Serial.saida.clear(); corre(2); t("HELLO? → HELLO com o tamanho do LCD", Serial.saida.find("HELLO|2|20x4") != std::string::npos);
  // queda
  corre(SEM_CONEXAO_MS + 50); t("sem mensagens por 6 s: SEM CONEXAO no LCD", lcdTxt().find("SEM CONEXAO") != std::string::npos, lcdTxt());
  Serial.manda(linha("L|DE VOLTA|")); corre(2); t("voltou a receber: mostra o jogo de novo", lcd->L[0].rfind("DE VOLTA", 0) == 0, lcdTxt());
  // botões continuam funcionando sem conexão
  corre(SEM_CONEXAO_MS + 50); Serial.saida.clear(); _pino[PINO_DESPAUSA] = LOW; corre(40); _pino[PINO_DESPAUSA] = HIGH; corre(40);
  t("botões funcionam mesmo sem conexão (o jogo reconecta e recebe)", conta(Serial.saida, "RESUME_PRESS*") == 1);
  // ---------- botões configuráveis (mapa na EEPROM) ----------
  auto aperta = [](int p, uint32_t segura = 40) { _pino[p] = LOW; corre(segura); _pino[p] = HIGH; corre(40); };
  Serial.manda(linha("MAPA?")); Serial.saida.clear(); corre(2);
  t("MAPA? → mapa padrão do config.h", Serial.saida.find("MAPA|2,3,4,5,6,7,8*") != std::string::npos, Serial.saida);
  Serial.manda(linha("APRENDER|1")); Serial.saida.clear(); corre(2); t("APRENDER|1 confirmado", Serial.saida.find("APRENDER|1*") != std::string::npos, Serial.saida);
  Serial.saida.clear(); aperta(11); aperta(A2); aperta(PINO_CIMA); aperta(PINO_ARCADE, 300);
  t("aprendendo: cada aperto manda PINO|n (inclusive pino sem função e analógico)", conta(Serial.saida, "PINO|11*") == 1 && conta(Serial.saida, "PINO|16*") == 1 && conta(Serial.saida, "PINO|2*") == 1 && conta(Serial.saida, "PINO|8*") == 1, Serial.saida);
  t("aprendendo: nenhum comando de jogo sai (nem UP nem ARCADE)", conta(Serial.saida, "UP_PRESS") + conta(Serial.saida, "ARCADE_") == 0, Serial.saida);
  Serial.manda(linha("MAPA|9,10,11,12,A0")); Serial.saida.clear(); corre(2); t("mapa com formato errado: MAPA_ERRO", Serial.saida.find("MAPA_ERRO|FORMATO") != std::string::npos, Serial.saida);
  Serial.manda(linha("MAPA|9,10,11,12,14,14,15")); Serial.saida.clear(); corre(2); t("pino repetido: MAPA_ERRO", Serial.saida.find("MAPA_ERRO|PINO") != std::string::npos, Serial.saida);
  Serial.manda(linha("MAPA|9,10,11,12,14,13,15")); Serial.saida.clear(); corre(2); t("pino fora da lista (D13): MAPA_ERRO", Serial.saida.find("MAPA_ERRO|PINO") != std::string::npos, Serial.saida);
  Serial.manda(linha("MAPA|9,10,11,12,14,15,16")); Serial.saida.clear(); corre(2);
  t("mapa novo aceito e devolvido", Serial.saida.find("MAPA|9,10,11,12,14,15,16*") != std::string::npos, Serial.saida);
  Serial.manda(linha("APRENDER|0")); corre(2); Serial.saida.clear();
  aperta(9); aperta(12); aperta(14); aperta(15); aperta(PINO_CIMA); aperta(PINO_ARCADE);
  t("mapa novo vale na hora: D9 = UP, D12 = RIGHT, A0 = PAUSE, A1 = RESUME", conta(Serial.saida, "UP_PRESS*") == 1 && conta(Serial.saida, "RIGHT_PRESS*") == 1 && conta(Serial.saida, "PAUSE_PRESS*") == 1 && conta(Serial.saida, "RESUME_PRESS*") == 1, Serial.saida);
  t("pinos antigos (D2, D8) ficaram sem função", conta(Serial.saida, "PINO|") == 0 && conta(Serial.saida, "ARCADE_DOWN") == 0, Serial.saida);
  Serial.saida.clear(); _pino[A2] = LOW; _ms++; loop(); bool naHora = Serial.saida.find("ARCADE_DOWN*") != std::string::npos; corre(499); _pino[A2] = HIGH; corre(60);
  { size_t p = Serial.saida.find("ARCADE_UP|"); int msS = p == std::string::npos ? -1 : atoi(Serial.saida.c_str() + p + 10);
    t("ARCADE no A2: DOWN no 1º ms e UP com o tempo exato (500 ms)", naHora && msS == 500, Serial.saida); }
  Serial.saida.clear(); _pino[10] = LOW; corre(1000); _pino[10] = HIGH; corre(50); t("DOWN no D10 repete quando segurado", conta(Serial.saida, "DOWN_REPEAT*") >= 3, Serial.saida);
  t("o mapa foi gravado na EEPROM", EEPROM.mem[0] == 'P' && EEPROM.mem[1] == 'M' && EEPROM.mem[3] == 9 && EEPROM.mem[9] == 16);
  { int esc = EEPROM.escritas; Serial.manda(linha("MAPA|9,10,11,12,14,15,16")); corre(2); t("regravar o mesmo mapa não gasta a EEPROM (update)", EEPROM.escritas == esc); }
  setup(); Serial.manda(linha("MAPA?")); Serial.saida.clear(); corre(2);
  t("depois de religar, o Arduino lembra o mapa", Serial.saida.find("MAPA|9,10,11,12,14,15,16*") != std::string::npos, Serial.saida);
  EEPROM.mem[5] ^= 1; setup(); Serial.manda(linha("MAPA?")); Serial.saida.clear(); corre(2);
  t("EEPROM corrompida: volta ao mapa padrão", Serial.saida.find("MAPA|2,3,4,5,6,7,8*") != std::string::npos, Serial.saida);
  Serial.manda(linha("APRENDER|1")); corre(2); _pino[PINO_ARCADE] = LOW; corre(5); Serial.manda(linha("APRENDER|0")); corre(2); Serial.saida.clear();
  _pino[PINO_ARCADE] = LOW; corre(50); Serial.manda(linha("APRENDER|1")); Serial.saida.clear(); corre(2);
  t("entrar no modo aprender com o ARCADE apertado solta o arcade (ARCADE_UP)", Serial.saida.find("ARCADE_UP|") != std::string::npos, Serial.saida);
  _pino[PINO_ARCADE] = HIGH; corre(40);
  Serial.manda(linha("APRENDER|1")); corre(2); corre(SEM_CONEXAO_MS + 50); Serial.saida.clear(); aperta(PINO_CIMA);
  t("sem conexão, sai do modo aprender (o botão volta a funcionar)", conta(Serial.saida, "UP_PRESS*") == 1 && conta(Serial.saida, "PINO|") == 0, Serial.saida);
  Serial.manda(linha("MAPA|9,10,11,12,14,15,16")); corre(2); Serial.manda(linha("MAPA|PADRAO")); Serial.saida.clear(); corre(2);
  t("MAPA|PADRAO volta ao config.h", Serial.saida.find("MAPA|2,3,4,5,6,7,8*") != std::string::npos, Serial.saida);
  // todas as linhas enviadas são válidas pelo próprio receptor
  { arcade::Receptor r2; int boas = 0, total = 0; for (char c : Serial.saida) { if (c == '\n') total++; if (r2.recebe(c)) boas++; } t("tudo que o Arduino envia tem checksum válido", total > 0 && boas == total); }
  std::cout << "FIRMWARE OK " << ok << " | FALHAS " << falhas << "\n"; return falhas ? 1 : 0;
}
