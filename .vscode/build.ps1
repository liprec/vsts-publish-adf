[CmdletBinding()]
param(
    [string]$manifestFile
)

$result = Invoke-Pester -Script @{ Path = './tests/*' } -PassThru -Show None

$totalCount = $result.TotalCount
$passedCount = $result.PassedCount
$failedCount = $result.FailedCount
$skippedCount = $result.SkippedCount

Write-Output "Pester test results:"
Write-Output "Total tests        : $totalCount"
Write-Output "Total tests passed : $passedCount"
Write-Output "Total tests failed : $failedCount"
Write-Output "Total tests skipped: $skippedCount"

# No test errors, so we can build
if ($result.FailedCount -eq 0) {
    tfx extension --manifest-globs $manifestFile
    Write-Output ""
    Write-Output "Build complete"
} else {
    Write-Output ""
    Write-Output "Build failed"
}
