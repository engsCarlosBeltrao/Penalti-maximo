// Imitação MÍNIMA do Arduino para compilar e testar o firmware no PC (g++). Só o que o firmware usa: pinos, millis, Serial, Wire e o LCD I2C.
#pragma once
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <string>
#include <deque>
#define INPUT_PULLUP 2
#define LOW 0
#define HIGH 1
#define A0 14
#define A1 15
#define A2 16
#define A3 17
inline uint32_t _ms = 0; inline int _pino[64];
inline void pinMode(int, int) {}
inline int digitalRead(int p) { return _pino[p]; }
inline uint32_t millis() { return _ms; }
struct SerialMock { std::string saida; std::deque<char> entrada; void begin(long) {} int available() { return (int)entrada.size(); } int read() { char c = entrada.front(); entrada.pop_front(); return c; }
  void print(const char* s) { saida += s; } void manda(const std::string& s) { for (char c : s) entrada.push_back(c); } };
inline SerialMock Serial;
struct WireMock { int presente = 0x27, a = 0; void begin() {} void beginTransmission(int x) { a = x; } int endTransmission() { return a == presente ? 0 : 2; } };
inline WireMock Wire;
struct LiquidCrystal_I2C { int a, c, r, cx = 0, cy = 0; bool luz = false; std::string L[4];
  LiquidCrystal_I2C(int a_, int c_, int r_) : a(a_), c(c_), r(r_) { clear(); }
  void init() {} void backlight() { luz = true; } void noBacklight() { luz = false; } void clear() { for (auto& s : L) s = std::string(c, ' '); }
  void setCursor(int x, int y) { cx = x; cy = y; } void print(const char* s) { for (; *s && cx < c; s++) L[cy][cx++] = *s; } };
