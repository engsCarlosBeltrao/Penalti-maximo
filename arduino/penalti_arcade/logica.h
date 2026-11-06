// LÓGICA DO ARCADE SEM DEPENDER DO ARDUINO (compila também no PC: arduino/teste_host): debounce e eventos dos botões, montagem e validação das
// linhas do protocolo (checksum XOR em hexadecimal) e decodificação das linhas do LCD. Ver js/hardware/protocolo.js para a especificação.
#pragma once
#include <stdint.h>
#include <string.h>
#include <stdio.h>

namespace arcade {

// ---------- checksum / montagem ----------
inline uint8_t xorDe(const char* s, size_t n) { uint8_t x = 0; for (size_t i = 0; i < n; i++) x ^= (uint8_t)s[i]; return x; }
// escreve "<corpo>*HH\n" em out (cap bytes); devolve o tamanho ou 0 se não couber
inline size_t monta(const char* corpo, char* out, size_t cap) {
  size_t n = strlen(corpo); if (n + 5 > cap) return 0;
  memcpy(out, corpo, n); uint8_t x = xorDe(corpo, n); const char* H = "0123456789ABCDEF";
  out[n] = '*'; out[n + 1] = H[x >> 4]; out[n + 2] = H[x & 15]; out[n + 3] = '\n'; out[n + 4] = 0; return n + 4;
}

// ---------- botão com debounce ----------
enum Evento : uint8_t { NADA = 0, APERTOU, REPETIU, SOLTOU };
struct Botao {
  const char* nome; bool repete;          // repete = direcional (gera REPEAT segurado)
  bool imediato = false;                  // imediato = vale NO PRIMEIRO contato (sem esperar estabilizar) e ignora os quiques seguintes: latência zero (ARCADE)
  bool estavel = false, bruto = false; uint32_t tMuda = 0, tApertou = 0, tRep = 0;
  Botao(const char* n, bool r, bool im = false) : nome(n), repete(r), imediato(im) {}   // construtor explícito: o avr-gcc (C++11) exige
  // apertadoAgora = leitura crua do pino (já invertida: true = apertado). Devolve no máximo UM evento por chamada.
  Evento atualiza(bool apertadoAgora, uint32_t ms, uint16_t debounce, uint16_t atraso, uint16_t intervalo) {
    if (imediato) {                                                                  // borda aceita na hora; depois dela, `debounce` ms de trava contra o quique
      if (apertadoAgora != estavel && (uint32_t)(ms - tMuda) >= debounce) { estavel = apertadoAgora; tMuda = ms; if (estavel) { tApertou = ms; return APERTOU; } return SOLTOU; }
      return NADA;
    }
    if (apertadoAgora != bruto) { bruto = apertadoAgora; tMuda = ms; }              // mudou: reinicia a contagem de estabilidade
    if (bruto != estavel && (uint32_t)(ms - tMuda) >= debounce) {                   // ficou estável o bastante: vale
      estavel = bruto;
      if (estavel) { tApertou = ms; tRep = ms + atraso; return APERTOU; }
      return SOLTOU;
    }
    if (estavel && repete && (int32_t)(ms - tRep) >= 0) { tRep = ms + intervalo; return REPETIU; }
    return NADA;
  }
  uint32_t segurado(uint32_t ms) const { return ms - tApertou; }
};

// ---------- recepção de linhas do jogo ----------
// junta bytes até "\n"; descarta linha longa demais, com caractere não imprimível ou checksum errado. Quando completa e válida, corpo() = conteúdo
struct Receptor {
  static const uint8_t CAP = 120;
  char buf[CAP + 1]; uint8_t n = 0; bool lixo = false; uint16_t invalidas = 0;
  // devolve true quando uma linha VÁLIDA terminou (o conteúdo, sem "*HH", fica em buf)
  bool recebe(char c) {
    if (c == '\r') return false;
    if (c == '\n') { bool ok = !lixo && n > 0 && valida(); if (!ok && (n > 0 || lixo)) invalidas++; if (!ok) buf[0] = 0; n = 0; lixo = false; return ok; }
    if (lixo) return false;
    if (c < 0x20 || c > 0x7e || n >= CAP) { lixo = true; return false; }
    buf[n++] = c; return false;
  }
  bool valida() {   // "<corpo>*HH": confere e corta o checksum
    if (n < 4 || buf[n - 3] != '*') return false;
    auto hex = [](char h) -> int { return h >= '0' && h <= '9' ? h - '0' : h >= 'A' && h <= 'F' ? h - 'A' + 10 : h >= 'a' && h <= 'f' ? h - 'a' + 10 : -1; };
    int a = hex(buf[n - 2]), b = hex(buf[n - 1]); if (a < 0 || b < 0) return false;
    if (xorDe(buf, n - 3) != (uint8_t)(a*16 + b)) return false;
    n -= 3; buf[n] = 0; return true;
  }
  const char* corpo() const { return buf; }
};

// ---------- tela do LCD ----------
// "L|lin1|lin2|..." → até `linhas` linhas de `cols` caracteres (completa com espaço). Devolve quantas linhas vieram, ou -1 se não for "L|".
template <uint8_t COLS, uint8_t LINHAS>
struct Tela {
  char l[LINHAS][COLS + 1];
  Tela() { limpa(); }
  void limpa() { for (uint8_t i = 0; i < LINHAS; i++) { memset(l[i], ' ', COLS); l[i][COLS] = 0; } }
  void poe(uint8_t i, const char* s) { if (i >= LINHAS) return; memset(l[i], ' ', COLS); for (uint8_t k = 0; k < COLS && s[k]; k++) l[i][k] = s[k]; }
  int deLinhaL(const char* corpo) {
    if (corpo[0] != 'L' || corpo[1] != '|') return -1;
    limpa(); const char* p = corpo + 2; uint8_t i = 0;
    while (i < LINHAS) { uint8_t k = 0; while (*p && *p != '|') { if (k < COLS) l[i][k++] = *p; p++; } i++; if (!*p) break; p++; }
    return i;
  }
};

}  // namespace arcade
