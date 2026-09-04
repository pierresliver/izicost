# IziCost — local Android release build (no EAS, no queue, no quota).
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\build-apk.ps1
# Output: builds\izicost-v<version>-<date>.apk  (install on the phone; over-installs previous builds)
#
# Prerequisites (already on this PC): JDK 22 at C:\Program Files\Java\jdk-22, Android SDK at D:\Android\Sdk.
# The APK is signed with the debug keystore, which is fine for testing. Before a Play Store release
# we create a permanent keystore (like IziCamera's) and switch the signing config.
# Options:  -Abi 'arm64-v8a'   build for one processor type only (smaller file)
#           -Slim              also enable code minification (R8) + resource shrinking (smaller again; the published download uses this)
# Example (the download build): powershell -ExecutionPolicy Bypass -File scripts\build-apk.ps1 -Abi arm64-v8a -Slim
param(
  [string]$Abi = 'armeabi-v7a,arm64-v8a',
  [switch]$Slim
)
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
$gpText = Get-Content $gp -Raw
$gpText = [regex]::Replace($gpText, '(?m)^reactNativeArchitectures=.*$', "reactNativeArchitectures=$Abi")
foreach ($k in @('android.enableMinifyInReleaseBuilds', 'android.enableProguardInReleaseBuilds', 'android.enableShrinkResourcesInReleaseBuilds')) {
  $v = if ($Slim) { 'true' } else { 'false' }
  if ($gpText -match "(?m)^$([regex]::Escape($k))=") { $gpText = [regex]::Replace($gpText, "(?m)^$([regex]::Escape($k))=.*$", "$k=$v") }
  else { $gpText = $gpText.TrimEnd() + "`n$k=$v`n" }
}
[System.IO.File]::WriteAllText($gp, $gpText, (New-Object System.Text.UTF8Encoding($false)))

# Guard: an interrupted prebuild leaves the template project behind ("com.helloworld"). Never build that.
$expectedId = (node -p "require('./app.json').expo.android.package")
$expectedCode = (node -p "require('./app.json').expo.android.versionCode")
$gradleText = Get-Content 'android\app\build.gradle' -Raw
if ($gradleText -notmatch [regex]::Escape($expectedId)) {
  throw "android/app/build.gradle does not carry applicationId $expectedId (interrupted prebuild?). Run: npx expo prebuild --platform android --no-install --clean  (in app\) and build again."
}

Write-Host '>> gradle assembleRelease...' -ForegroundColor Cyan
& 'android\gradlew.bat' -p android assembleRelease
if ($LASTEXITCODE -ne 0) { throw 'gradle build failed' }

# Guard: the APK must really be IziCost with the version from app.json (checked with aapt from the Android SDK).
$aapt = Get-ChildItem 'D:\Android\Sdk\build-tools\*\aapt.exe' -ErrorAction SilentlyContinue | Sort-Object FullName | Select-Object -Last 1
if ($aapt) {
  $badging = (& $aapt.FullName dump badging 'android\app\build\outputs\apk\release\app-release.apk' 2>$null | Select-String '^package:' | Select-Object -First 1).ToString()
  if ($badging -notmatch [regex]::Escape("name='$expectedId'") -or $badging -notmatch [regex]::Escape("versionCode='$expectedCode'")) {
    throw "APK check FAILED: $badging (expected $expectedId versionCode $expectedCode). Nothing copied to builds\."
  }
  Write-Host ">> APK check OK: $badging" -ForegroundColor Green
} else {
  Write-Host '>> aapt not found: APK package check skipped' -ForegroundColor Yellow
}

$ver = (node -p "require('./app.json').expo.version")
$stamp = Get-Date -Format 'yyyy-MM-dd-HHmm'
$suffix = if ($Abi -notmatch ',') { "-$($Abi -replace '-v8a','')" } else { '' }
if ($Slim) { $suffix += '-slim' }
$out = Join-Path $root "builds\izicost-v$ver-$stamp$suffix.apk"
New-Item -ItemType Directory -Force (Join-Path $root 'builds') | Out-Null
Copy-Item 'android\app\build\outputs\apk\release\app-release.apk' $out -Force
Write-Host ">> BUILD OK: $out" -ForegroundColor Green
