# Abre uma música do Spotify no APLICATIVO do Windows (protocolo spotify:, registrado pelo instalador do Spotify) e devolve o foco à janela que estava
# na frente (o jogo). Chamado pelo servidor local do jogo (tools/servidor.mjs → /spotify-abrir). Só aceita spotify:track:<id> e spotify:playlist:<id>.
# O áudio sai do próprio aplicativo Spotify; nada é baixado nem gravado.
param([string]$Uri)
if ($Uri -notmatch '^spotify:(track|playlist):[A-Za-z0-9]{22}$') { exit 2 }
Add-Type @"
using System; using System.Runtime.InteropServices;
public class PmJanela {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, int flags, int extra);
}
"@
$antes = [PmJanela]::GetForegroundWindow()
Start-Process $Uri
$sp = [IntPtr]::Zero
for ($i = 0; $i -lt 25; $i++) {                                   # até 2,5 s: espera o Spotify vir para a frente
  Start-Sleep -Milliseconds 100
  $fg = [PmJanela]::GetForegroundWindow()
  if ($fg -ne $antes) { $sp = $fg; break }
}
if ($sp -ne [IntPtr]::Zero -and $antes -ne [IntPtr]::Zero) {
  [PmJanela]::keybd_event(0x12, 0, 0, 0)                          # ALT (o Windows só deixa trocar o foco depois de uma tecla)
  [void][PmJanela]::SetForegroundWindow($antes)
  [PmJanela]::keybd_event(0x12, 0, 2, 0)
  Start-Sleep -Milliseconds 150
  if ([PmJanela]::GetForegroundWindow() -ne $antes) { [void][PmJanela]::ShowWindow($sp, 6); [void][PmJanela]::SetForegroundWindow($antes) }   # não deu: minimiza o Spotify
}
exit 0
