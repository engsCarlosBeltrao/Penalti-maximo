// Bola: desenho INSPIRADO no visual da bola Nike/CBF do Brasileirão (branca com formas azuis e toques verdes — referência: CBF/Nike Flight 2023).
// NÃO é a textura oficial nem a bola da temporada atual (não identificada em fonte confiável). Para usar uma textura licenciada, troque drawBall.
export function drawBall(c, P, b) {
  c.fillStyle = 'rgba(0,0,0,.32)'; c.beginPath(); c.ellipse(P.x + 6*P.s, P.gy, 14*P.s, 4.5*P.s, 0, 0, 7); c.fill();        // sombra no gramado
  const t = b ? Math.max(0, b.t) : 0, spin = t*14, tilt = t*9;
  c.save(); c.translate(P.x, P.y); c.scale(P.s, P.s);
  c.beginPath(); c.arc(0, 0, 13, 0, 7); c.clip();
  let g = c.createRadialGradient(-4, -5, 1, 0, 0, 14); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d3dae4'); c.fillStyle = g; c.fillRect(-14, -14, 28, 28);
  for (let i = 0; i < 5; i++) {                      // painéis azuis que "giram" (pseudo-3D: posição e achatamento variam com o giro)
    const a = i*1.2566 + spin, dx = Math.cos(a), dy = Math.sin(a)*Math.cos(tilt), depth = Math.sin(a)*Math.sin(tilt);
    if (depth < -.2) continue; c.save(); c.translate(dx*8.2, dy*8.2); c.rotate(a); c.scale(1, .55 + .45*Math.abs(Math.cos(tilt)));
    c.fillStyle = '#1d4fa6'; c.beginPath(); c.moveTo(-4.8, -3.4); c.quadraticCurveTo(0, -6.8, 4.8, -3.4); c.lineTo(3.4, 3.8); c.quadraticCurveTo(0, 5.8, -3.4, 3.8); c.closePath(); c.fill();
    c.strokeStyle = '#19a35a'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(-3.8, 4.6); c.quadraticCurveTo(0, 7, 3.8, 4.6); c.stroke(); c.restore();
  }
  c.strokeStyle = 'rgba(40,60,90,.35)'; c.lineWidth = .8; c.beginPath(); c.arc(0, 0, 8.2, spin, spin + 2.2); c.stroke();          // costura
  g = c.createRadialGradient(5, 5, 4, 0, 0, 14); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,10,30,.38)'); c.fillStyle = g; c.fillRect(-14, -14, 28, 28);   // volume
  c.restore();
}
