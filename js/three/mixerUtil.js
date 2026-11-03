// O PropertyMixer do three só escreve no osso quando o valor calculado difere do da avaliação ANTERIOR daquele mixer. Com vários mixers (e as
// misturas de transição) mexendo nos mesmos ossos, um clipe avaliado de novo no mesmo instante (ex.: o 1º quadro da cobrança durante o
// "carregando") deixaria os ossos com a pose de outro clipe — o cobrador "pulava" para a bola. forceWrite invalida o resultado anterior para
// que a próxima avaliação SEMPRE escreva. (vendor/three é versão fixa, r160: AnimationMixer._bindings, PropertyMixer.buffer/valueSize)
export function forceWrite(mixer) {
  for (const pm of mixer._bindings || []) { const b = pm.buffer, n = pm.valueSize; for (let i = n; i < 3*n; i++) b[i] = NaN; }
}
