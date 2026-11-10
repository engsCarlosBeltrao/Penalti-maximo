// Imitação da EEPROM do Arduino (1 KB) para o teste no PC: o conteúdo sobrevive a um novo setup(), como na placa.
#pragma once
#include <cstdint>
struct EEPROMMock { uint8_t mem[1024]; int escritas = 0; EEPROMMock() { for (auto& b : mem) b = 0xFF; }
  uint8_t read(int a) { return mem[a]; } void update(int a, uint8_t v) { if (mem[a] != v) { mem[a] = v; escritas++; } } void write(int a, uint8_t v) { mem[a] = v; escritas++; } };
inline EEPROMMock EEPROM;
