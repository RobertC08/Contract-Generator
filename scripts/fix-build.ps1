# Run from project root (contract-generator). Removes old TipTap files and fixes sign/submit import.
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot + "\.."
Set-Location $root

Write-Host "Removing TipTap components..."
Remove-Item -Force "app\components\template-editor.tsx" -ErrorAction SilentlyContinue
Remove-Item -Force "app\components\tiptap-variable-extension.ts" -ErrorAction SilentlyContinue

$submitPath = "app\api\sign\submit\route.ts"
if (Test-Path $submitPath) {
  $content = Get-Content $submitPath -Raw
  if ($content -match "regenerateContractPdf") {
    Write-Host "Fixing sign/submit import..."
    $content = $content -replace "regenerateContractPdf", "regenerateContractDocument"
    Set-Content $submitPath -Value $content -NoNewline
  }
}

Write-Host "Clearing .next cache..."
Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue

Write-Host "Done. Run: npm run build"
