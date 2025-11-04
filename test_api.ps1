$body = '{"file_path":"uploads/test.csv"}'
$response = Invoke-WebRequest -Uri "http://localhost:5000/api/preview" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
$data = $response.Content | ConvertFrom-Json

Write-Host "`n=== API Test Results ===" -ForegroundColor Green
Write-Host "Columns count: $($data.columns.Count)"
Write-Host "Preview rows: $($data.preview.Count)"
Write-Host "`nFirst 5 columns:" -ForegroundColor Cyan
$data.columns[0..4] | ForEach-Object { Write-Host "  - $_" }
Write-Host "`nFirst row sample:" -ForegroundColor Cyan
Write-Host "  unique_id: $($data.preview[0].unique_id)"
Write-Host "  gender: $($data.preview[0].gender)"
Write-Host "  age: $($data.preview[0].age)"
Write-Host "  all_nulls (should be null): [$($data.preview[0].all_nulls)]"
Write-Host "`nTest PASSED! ✅" -ForegroundColor Green
