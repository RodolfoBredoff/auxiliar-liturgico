# Cria venv Python para escuta + track sync (Windows).
# Uso: powershell -ExecutionPolicy Bypass -File .\scripts\setup_python_runtime.ps1

$ErrorActionPreference = "Stop"
$DataDir = if ($env:AUXILIAR_DATA_DIR) { $env:AUXILIAR_DATA_DIR } else { Join-Path $env:LOCALAPPDATA "com.igreja.auxiliar" }
$Venv = Join-Path $DataDir "python"

$Python = $null
foreach ($name in @("py -3.12", "py -3.11", "python3.12", "python")) {
  try {
    $cmd = $name -split " "
    & $cmd[0] @($cmd[1..($cmd.Length-1)] | Where-Object { $_ }) -c "import sys; sys.exit(0 if (3,9)<=sys.version_info[:2]<=(3,13) else 1)" 2>$null
    if ($LASTEXITCODE -eq 0) {
      $Python = $name
      break
    }
  } catch { }
}

if (-not $Python) {
  Write-Error "Python 3.9–3.13 não encontrado. Instale de https://www.python.org/downloads/"
}

Write-Host "Usando $Python"
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
& $Python -m venv $Venv
& (Join-Path $Venv "Scripts\pip.exe") install --quiet --upgrade pip
& (Join-Path $Venv "Scripts\pip.exe") install --quiet faster-whisper==1.2.1 sounddevice==0.5.6

Write-Host "Baixando modelo Whisper 'small' (~500 MB na primeira vez)..."
& (Join-Path $Venv "Scripts\python.exe") -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8')"

Write-Host "Pronto: $Venv"
