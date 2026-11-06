// TELA "ARCADE / ARDUINO" (menu principal): conectar, escolher a porta, desconectar, ver o estado da ligação, testar cada botão e o LCD, ver os
// comandos recebidos e usar o SIMULADOR (botões na tela que mandam as mesmas linhas do Arduino) quando não houver hardware.
const BOT = [['UP', '▲ CIMA'], ['DOWN', '▼ BAIXO'], ['LEFT', '◀ ESQUERDA'], ['RIGHT', '▶ DIREITA'], ['ADVANCE', 'AVANÇAR'], ['BACK', 'VOLTAR'], ['ARCADE', 'ARCADE (CHUTE)']];
const NOMES = { conectado: 'CONECTADO', 'sem-resposta': 'SEM RESPOSTA', conectando: 'CONECTANDO…', desconectado: 'DESCONECTADO' };
export function telaArcade({ show, on, voltar, Arduino }) {
  const disp = Arduino.disponivel();
  show(`<h2>Arcade / Arduino</h2>
  <div class="box ard" style="max-height:360px;width:900px">
    <div class="ard-l">
      <p id="ar-st" class="ard-st"></p><p id="ar-info" class="hint"></p>
      ${disp ? '' : `<p class="hint" style="color:#ff9f1c">${Arduino.motivoIndisponivel()} O simulador continua disponível.</p>`}
      <div class="ard-bt"><button id="ar-con" ${disp ? '' : 'disabled'}>CONECTAR (escolher porta)</button><button id="ar-rec" class="sec sm" ${disp ? '' : 'disabled'}>RECONECTAR PORTA AUTORIZADA</button>
      <button id="ar-sim" class="sec sm">USAR SIMULADOR</button><button id="ar-des" class="sec sm">DESCONECTAR</button><button id="ar-lcd" class="sec sm">TESTAR LCD</button></div>
      <p class="hint">Botões (acendem quando o Arduino manda):</p><div class="ard-bot">${BOT.map(([k, n]) => `<span id="ar-b-${k}" class="ard-led">${n}<small></small></span>`).join('')}</div>
      <div id="ar-simbox" class="ard-sim" hidden><p class="hint">Simulador — aperte como no arcade (o ARCADE: segure e solte):</p>
        ${BOT.map(([k, n]) => `<button class="sm sec" data-sim="${k}">${n}</button>`).join('')}</div>
    </div>
    <div class="ard-r"><p class="hint">LCD (o que o jogo está mandando):</p><pre id="ar-lcd-v" class="ard-lcdv"></pre><p class="hint">Comandos recebidos:</p><pre id="ar-log" class="ard-log"></pre></div>
  </div><button id="b" class="sec">VOLTAR</button>`);
  const $ = id => document.getElementById(id);
  const pinta = () => { if (!$('ar-st')) return;
    $('ar-st').textContent = `Estado: ${NOMES[Arduino.estado] || Arduino.estado}${Arduino.modo ? ' · ' + (Arduino.modo === 'simulador' ? 'SIMULADOR' : 'USB') : ''}${Arduino.motivo ? ' — ' + Arduino.motivo : ''}`;
    $('ar-st').className = 'ard-st ' + (Arduino.estado === 'conectado' ? 'ok' : Arduino.estado === 'desconectado' ? 'off' : 'warn');
    const c = Arduino.con; $('ar-info').textContent = c ? `LCD ${Arduino.lcd.cols}x${Arduino.lcd.rows}${Arduino.info ? ' · firmware ' + Arduino.info.versao : ''} · recebidas ${c.recebidas} · descartadas ${c.invalidas} · enviadas ${c.enviadas}` : 'Sem Arduino o jogo funciona normalmente com teclado e mouse.';
    const agora = Arduino.relogio(); BOT.forEach(([k]) => { const s = Arduino.botoes[k], el = $('ar-b-' + k); el.classList.toggle('on', !!s && agora - s.t < .35); el.querySelector('small').textContent = s ? ` ${s.n}×` : ''; });
    const lin = Arduino.lcd.atual || []; $('ar-lcd-v').textContent = lin.join('\n') || '(nada enviado ainda)';
    $('ar-log').textContent = Arduino.log.slice(0, 14).join('\n'); $('ar-simbox').hidden = Arduino.modo !== 'simulador'; };
  Arduino.onMuda = pinta; const timer = setInterval(() => { if (!$('ar-st')) { clearInterval(timer); if (Arduino.onMuda === pinta) Arduino.onMuda = null; } else pinta(); }, 150);
  on('ar-con', () => Arduino.conectar({ escolher: true })); on('ar-rec', () => Arduino.conectar({ escolher: false })); on('ar-sim', () => Arduino.conectar({ simulador: true }));
  on('ar-des', () => Arduino.desconectar()); on('ar-lcd', () => Arduino.testarLCD()); on('b', voltar);
  document.querySelectorAll('[data-sim]').forEach(b => { const k = b.dataset.sim, s = () => Arduino.sim;
    if (k === 'ARCADE') { b.onpointerdown = e => { e.preventDefault(); s()?.arcadeDown(Arduino.relogio()); }; b.onpointerup = () => s()?.arcadeUp(Arduino.relogio()); b.onclick = null; }
    else b.onclick = () => s()?.aperta(k); });
  pinta();
}
