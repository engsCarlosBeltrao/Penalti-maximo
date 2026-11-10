// TELA "ARCADE / ARDUINO" (menu principal): conectar, escolher a porta, desconectar, ver o estado da ligação, testar cada botão e o LCD, ver os
// comandos recebidos, CONFIGURAR BOTÕES (o jogo pede cada função e você aperta o botão físico; o mapa fica gravado no Arduino) e usar o
// SIMULADOR (botões na tela que mandam as mesmas linhas do Arduino) quando não houver hardware.
import { FUNCOES as BOT, nomePino } from './protocolo.js';   // as 7 funções: cima, baixo, esquerda, direita, pausa, despausa, arcade
const curto = n => n.replace(/^[^A-Z]+/, '').split(' ')[0];
const NOMES = { conectado: 'CONECTADO', 'sem-resposta': 'SEM RESPOSTA', conectando: 'CONECTANDO…', desconectado: 'DESCONECTADO' };
export function telaArcade({ show, on, voltar, Arduino }) {
  const disp = Arduino.disponivel();
  show(`<h2>Arcade / Arduino</h2>
  <div class="box ard" style="max-height:360px;width:900px">
    <div class="ard-l">
      <p id="ar-st" class="ard-st"></p><p id="ar-info" class="hint"></p>
      ${disp ? '' : `<p class="hint" style="color:#ff9f1c">${Arduino.motivoIndisponivel()} O simulador continua disponível.</p>`}
      <div class="ard-bt"><button id="ar-con" ${disp ? '' : 'disabled'}>CONECTAR (escolher porta)</button><button id="ar-rec" class="sec sm" ${disp ? '' : 'disabled'}>RECONECTAR PORTA AUTORIZADA</button>
      <button id="ar-sim" class="sec sm">USAR SIMULADOR</button><button id="ar-des" class="sec sm">DESCONECTAR</button><button id="ar-lcd" class="sec sm">TESTAR LCD</button><button id="ar-cfg-ini" class="sm">CONFIGURAR BOTÕES</button><button id="ar-padrao" class="sec sm">PINOS PADRÃO (D2–D8)</button></div>
      <div id="ar-cfg" class="ard-cfg" hidden></div>
      <p class="hint">Botões (acendem quando o Arduino manda) <span id="ar-mapa"></span></p><div class="ard-bot">${BOT.map(([k, n]) => `<span id="ar-b-${k}" class="ard-led">${n}<small></small></span>`).join('')}</div>
      <div id="ar-simbox" class="ard-sim" hidden><p class="hint">Simulador — aperte como no arcade (o ARCADE: segure e solte):</p>
        ${BOT.map(([k, n]) => `<button class="sm sec" data-sim="${k}">${n}</button>`).join('')}</div>
    </div>
    <div class="ard-r"><p class="hint">LCD (o que o jogo está mandando):</p><pre id="ar-lcd-v" class="ard-lcdv"></pre><p class="hint">Comandos recebidos:</p><pre id="ar-log" class="ard-log"></pre></div>
  </div><button id="b" class="sec" data-voltar>VOLTAR</button>`);
  const $ = id => document.getElementById(id);
  const pinta = () => { if (!$('ar-st')) return;
    $('ar-st').textContent = `Estado: ${NOMES[Arduino.estado] || Arduino.estado}${Arduino.modo ? ' · ' + (Arduino.modo === 'simulador' ? 'SIMULADOR' : 'USB') : ''}${Arduino.motivo ? ' — ' + Arduino.motivo : ''}`;
    $('ar-st').className = 'ard-st ' + (Arduino.estado === 'conectado' ? 'ok' : Arduino.estado === 'desconectado' ? 'off' : 'warn');
    const c = Arduino.con; $('ar-info').textContent = c ? `LCD ${Arduino.lcd.cols}x${Arduino.lcd.rows}${Arduino.info ? ' · firmware ' + Arduino.info.versao : ''} · recebidas ${c.recebidas} · descartadas ${c.invalidas} · enviadas ${c.enviadas}` : 'Sem Arduino o jogo funciona normalmente com teclado e mouse.';
    const agora = Arduino.relogio(); BOT.forEach(([k]) => { const s = Arduino.botoes[k], el = $('ar-b-' + k); el.classList.toggle('on', !!s && agora - s.t < .35); el.querySelector('small').textContent = s ? ` ${s.n}×` : ''; });
    const lin = Arduino.lcd.atual || []; $('ar-lcd-v').textContent = lin.join('\n') || '(nada enviado ainda)';
    $('ar-log').textContent = Arduino.log.slice(0, 14).join('\n'); $('ar-simbox').hidden = Arduino.modo !== 'simulador';
    $('ar-mapa').textContent = Arduino.mapa ? '· pinos: ' + Arduino.mapa.map((p, i) => `${curto(BOT[i][1])} ${nomePino(p)}`).join(' · ') : '';
    pintaCfg(); };
  // assistente: passo atual em destaque, o que já foi gravado, aviso de botão repetido e o resultado (gravado / erro)
  let cfgChave = '';
  const pintaCfg = () => { const k = Arduino.config, box = $('ar-cfg'); box.hidden = !k; $('ar-cfg-ini').disabled = !!k && (k.estado === 'aprendendo' || k.estado === 'salvando');
    if (!k) { cfgChave = ''; return; } const chave = JSON.stringify(k); if (chave === cfgChave) return; cfgChave = chave;
    const titulo = k.estado === 'aprendendo' ? `Passo ${k.passo + 1} de ${BOT.length} — aperte no arcade o botão:` : k.estado === 'salvando' ? 'Gravando no Arduino…' : k.estado === 'pronto' ? 'Pronto!' : 'Não deu certo';
    box.innerHTML = `<p class="ard-cfg-t">${titulo}</p>${k.estado === 'aprendendo' ? `<p class="ard-cfg-f">${BOT[k.passo][1]}</p>` : `<p class="ard-cfg-m ${k.estado}">${k.msg || ''}</p>`}
      <div class="ard-cfg-l">${BOT.map(([, n], i) => `<span class="${i < k.pinos.length ? 'ok' : i === k.passo && k.estado === 'aprendendo' ? 'cur' : ''}">${n}<small>${i < k.pinos.length ? nomePino(k.pinos[i]) : '—'}</small></span>`).join('')}</div>
      ${k.aviso && k.estado === 'aprendendo' ? `<p class="hint ard-cfg-a">${k.aviso}</p>` : ''}
      <div class="ard-bt">${k.estado === 'aprendendo' ? `<button id="ar-cfg-v" class="sec sm" ${k.passo ? '' : 'disabled'}>VOLTAR UM PASSO</button><button id="ar-cfg-x" class="sec sm">CANCELAR</button>`
        : k.estado === 'salvando' ? '' : `<button id="ar-cfg-ok" class="sm">OK</button>${k.estado === 'erro' ? '<button id="ar-cfg-r" class="sec sm">TENTAR DE NOVO</button>' : ''}`}</div>`;
    const b = (id, f) => { const e = $(id); if (e) e.onclick = f; };
    b('ar-cfg-v', () => Arduino.configVoltar()); b('ar-cfg-x', () => Arduino.configCancelar()); b('ar-cfg-ok', () => Arduino.configCancelar()); b('ar-cfg-r', () => Arduino.configurar()); };
  Arduino.onMuda = pinta; const timer = setInterval(() => { if (!$('ar-st')) { clearInterval(timer); if (Arduino.onMuda === pinta) Arduino.onMuda = null; } else pinta(); }, 150);
  on('ar-con', () => Arduino.conectar({ escolher: true })); on('ar-rec', () => Arduino.conectar({ escolher: false })); on('ar-sim', () => Arduino.conectar({ simulador: true }));
  on('ar-des', () => Arduino.desconectar()); on('ar-lcd', () => Arduino.testarLCD()); on('ar-cfg-ini', () => Arduino.configurar()); on('ar-padrao', () => { if (!Arduino.mapaPadrao()) Arduino._cfgErro(Arduino.conectado ? 'O Arduino está com o firmware antigo: grave o firmware 2 (arduino/enviar.bat).' : 'Conecte o Arduino primeiro.'); }); on('b', voltar);
  document.querySelectorAll('[data-sim]').forEach(b => { const k = b.dataset.sim, s = () => Arduino.sim;
    if (k === 'ARCADE') { b.onpointerdown = e => { e.preventDefault(); s()?.arcadeDown(Arduino.relogio()); }; b.onpointerup = () => s()?.arcadeUp(Arduino.relogio()); b.onclick = null; }
    else b.onclick = () => s()?.aperta(k); });
  pinta();
}
