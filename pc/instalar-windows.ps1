# Instala Mi Bodega en esta PC: compila la app (app/) y el servidor local (pc/), y crea los
# accesos directos que la abren en una ventana de Comet.
# Uso: powershell -ExecutionPolicy Bypass -File pc\instalar-windows.ps1
# Volver a ejecutarlo actualiza la app sin borrar los datos (viven en el perfil de Comet).

$ErrorActionPreference = 'Stop'
$pc = Split-Path -Parent $MyInvocation.MyCommand.Path
$raiz = Split-Path -Parent $pc

Push-Location (Join-Path $raiz 'app')
try {
  if (-not (Test-Path node_modules)) { npm ci; if ($LASTEXITCODE) { throw 'npm ci falló' } }
  $env:VITE_BASE = '/'
  npm run build; if ($LASTEXITCODE) { throw 'No se pudo compilar la app' }
} finally { Pop-Location }

Push-Location $pc
try { cargo build --release; if ($LASTEXITCODE) { throw 'No se pudo compilar mi-bodega.exe' } } finally { Pop-Location }

$base = Join-Path $env:LOCALAPPDATA 'MiBodega'
$dir = Join-Path $base 'app'
$exe = Join-Path $dir 'mi-bodega.exe'

# Detener el servidor anterior para poder reemplazar el exe.
Get-Process mi-bodega -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 500

New-Item -ItemType Directory -Force $dir | Out-Null
Copy-Item (Join-Path $pc 'target\release\mi-bodega.exe') $exe -Force
$web = Join-Path $dir 'web'
if (Test-Path $web) { Remove-Item $web -Recurse -Force }
Copy-Item (Join-Path $raiz 'app\dist') $web -Recurse

# El servidor arranca con el acceso directo; no hace falta que quede corriendo al iniciar Windows.
Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'MiBodega' -ErrorAction SilentlyContinue

# Ícono para los accesos directos (los de Windows necesitan .ico).
$png = [IO.File]::ReadAllBytes((Join-Path $web 'icon-192.png'))
$ico = Join-Path $dir 'icon.ico'
$fs = [IO.File]::Create($ico); $bw = New-Object IO.BinaryWriter $fs
$bw.Write([uint16]0); $bw.Write([uint16]1); $bw.Write([uint16]1)
$bw.Write([byte]192); $bw.Write([byte]192); $bw.Write([byte]0); $bw.Write([byte]0)
$bw.Write([uint16]1); $bw.Write([uint16]32); $bw.Write([uint32]$png.Length); $bw.Write([uint32]22)
$bw.Write($png); $bw.Close()

$ws = New-Object -ComObject WScript.Shell
foreach ($l in @(
    (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Mi Bodega.lnk'),
    (Join-Path ([Environment]::GetFolderPath('Programs')) 'Mi Bodega.lnk'))) {
  $s = $ws.CreateShortcut($l)
  $s.TargetPath = $exe
  $s.Arguments = ''
  $s.IconLocation = $ico
  $s.WorkingDirectory = $dir
  $s.Description = 'Mi Bodega'
  $s.Save()
}
Write-Host "Mi Bodega instalada en $dir"
