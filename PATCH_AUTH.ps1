$ErrorActionPreference = "Stop"

$project = Split-Path -Parent $MyInvocation.MyCommand.Path
if ((Split-Path -Leaf $project) -eq "ychat-google-branding-fix") {
  $project = Split-Path -Parent $project
}

$login = Join-Path $project "app\auth\login\page.tsx"
$callback = Join-Path $project "app\auth\callback\route.ts"

if (-not (Test-Path $login)) { throw "Could not find $login" }
if (-not (Test-Path $callback)) { throw "Could not find $callback" }

$loginText = Get-Content $login -Raw
$loginText = $loginText.Replace('router.replace("/");', 'router.replace("/chat");')
$loginText = $loginText.Replace('redirectTo: authCallbackUrl,', 'redirectTo: `${authCallbackUrl}?next=/chat`,')
Set-Content -Path $login -Value $loginText -Encoding utf8

$callbackText = Get-Content $callback -Raw
$callbackText = $callbackText.Replace('requestUrl.searchParams.get("next") || "/"', 'requestUrl.searchParams.get("next") || "/chat"')
$callbackText = $callbackText.Replace('? requestedNext`r`n      : "/"', '? requestedNext`r`n      : "/chat"')
$callbackText = $callbackText.Replace('? requestedNext`n      : "/"', '? requestedNext`n      : "/chat"')
Set-Content -Path $callback -Value $callbackText -Encoding utf8

Write-Host "Auth redirects patched to /chat."
Write-Host "Now run: npm run build"
