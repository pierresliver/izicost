# IziCost — local Android release build (no EAS, no queue, no quota).
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\build-apk.ps1
# Output: builds\izicost-v<version>-<date>.apk  (install on the phone; over-installs previous builds)
#
# Prerequisites (already on this PC): JDK 22 at C:\Program Files\Java\jdk-22, Android SDK at D:\Android\Sdk.
# The APK is signed with the debug keystore, which is fine for testing. Before a Play Store release
# we create a permanent keystore (like IziCamera's) and switch the signing config.
$ErrorActionPreference = 'Stop'
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-22'
$env:ANDROID_HOME = 'D:\Android\Sdk'

$root = Split-Path -Parent $PSScriptRoot
$app = Join-Path $root 'app'
Set-Location $app

# Keep app/.env in sync with passwords/supabase.txt (public values only)
node (Join-Path $root 'scripts\sync-env.js')

# Regenerate the native project when missing or when app.json changed after the last prebuild
$appJsonTime = (Get-Item 'app.json').LastWriteTime
$needPrebuild = -not (Test-Path 'android\gradlew.bat')
if (-not $needPrebuild) {
  $gradleTime = (Get-Item 'android\app\build.gradle').LastWriteTime
  if ($appJsonTime -gt $gradleTime) { $needPrebuild = $true }
}
if ($needPrebuild) {
  Write-Host '>> running expo prebuild (android)...' -ForegroundColor Cyan
  npx expo prebuild --platform android --no-install
  if ($LASTEXITCODE -ne 0) { throw 'prebuild failed' }
}
[System.IO.File]::WriteAllText((Join-Path $app 'android\local.properties'), "sdk.dir=D:/Android/Sdk`n", (New-Object System.Text.UTF8Encoding($false)))

# Test builds for real phones only (drops the x86 emulator ABIs: ~40% smaller). prebuild resets this file.
$gp = Join-Path $app 'android\gradle.properties'
if (-not (Select-String -Path $gp -Pattern 'reactNativeArchitectures=armeabi' -Quiet)) {
  Add-Content -Path $gp -Value "`nreactNativeArchitectures=armeabi-v7a,arm64-v8a" -Encoding ascii
}

Write-Host '>> gradle assembleRelease...' -ForegroundColor Cyan
& 'android\gradlew.bat' -p android assembleRelease
if ($LASTEXITCODE -ne 0) { throw 'gradle build failed' }

$ver = (node -p "require('./app.json').expo.version")
$stamp = Get-Date -Format 'yyyy-MM-dd-HHmm'
$out = Join-Path $root "builds\izicost-v$ver-$stamp.apk"
New-Item -ItemType Directory -Force (Join-Path $root 'builds') | Out-Null
Copy-Item 'android\app\build\outputs\apk\release\app-release.apk' $out -Force
Write-Host ">> BUILD OK: $out" -ForegroundColor Green
