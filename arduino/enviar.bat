@echo off
rem Compila e envia o firmware do arcade usando o arduino-cli que vem dentro do Arduino IDE 2.
rem Uso:  enviar.bat                 (procura a placa sozinho; Arduino Uno)
rem       enviar.bat COM5            (porta fixa)
rem       enviar.bat COM5 nano       (Arduino Nano, bootloader novo)   |   enviar.bat COM5 nano-antigo   (Nano com bootloader antigo / clones CH340)
setlocal
cd /d "%~dp0"
set "CLI=%LOCALAPPDATA%\Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe"
if not exist "%CLI%" ( echo Nao achei o Arduino IDE 2 em "%LOCALAPPDATA%\Programs\Arduino IDE". Instale em https://www.arduino.cc/en/software & pause & exit /b 1 )
set "FQBN=arduino:avr:uno"
if /i "%2"=="nano" set "FQBN=arduino:avr:nano:cpu=atmega328"
if /i "%2"=="nano-antigo" set "FQBN=arduino:avr:nano:cpu=atmega328old"
"%CLI%" core install arduino:avr >nul
"%CLI%" lib install "LiquidCrystal I2C" >nul
echo Compilando para %FQBN% ...
"%CLI%" compile --fqbn %FQBN% penalti_arcade || ( echo ERRO na compilacao. & pause & exit /b 1 )
set "PORTA=%1"
if "%PORTA%"=="" for /f "tokens=1" %%p in ('"%CLI%" board list ^| findstr /r "^COM"') do if not defined PORTA set "PORTA=%%p"
if "%PORTA%"=="" ( echo Nenhuma placa encontrada. Ligue o Arduino no USB ^(ou informe a porta: enviar.bat COM5^). & pause & exit /b 1 )
echo Enviando para %PORTA% ...
"%CLI%" upload -p %PORTA% --fqbn %FQBN% penalti_arcade || ( echo ERRO no envio: feche o Monitor Serial do IDE e a aba do jogo conectada a placa e tente de novo. & pause & exit /b 1 )
echo Pronto. Abra o jogo, va em ARCADE / ARDUINO e clique em CONECTAR.
pause
