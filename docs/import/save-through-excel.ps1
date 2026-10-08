# Recalculates import-template.xlsx in Excel and saves it in place, so formula
# cells carry cached values. read-excel-file returns cached values only.
# Run after make-template.py: powershell -File docs/import/save-through-excel.ps1
$ErrorActionPreference = 'Stop'
$path = Join-Path $PSScriptRoot 'import-template.xlsx'
$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false
$xl.DisplayAlerts = $false
try {
  $wb = $xl.Workbooks.Open($path)
  $xl.CalculateFull()
  $wb.Save()
  $wb.Close($false)
} finally {
  $xl.Quit()
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($xl)
}
Write-Output "saved through Excel: $path"
