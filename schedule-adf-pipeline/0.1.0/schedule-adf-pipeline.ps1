[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation

$linkedModule = (Split-Path -Leaf $MyInvocation.MyCommand.Path).Replace('.ps1', '.psm1')

# Import the logic of the linked module
Import-Module $PSScriptRoot\$linkedModule -Force
Import-Module $PSScriptRoot\ps_modules\VstsAzureHelpers_
Initialize-Azure

# Definition parameter retrieval
$resourceGroupName = Get-VstsInput -Name "resourceGroupName" -Require
$adfname = Get-VstsInput -Name "adfname" -Require
$timeZone = Get-VstsInput -Name "timeZone"
$dateFixed = Get-VstsInput -Name "dateFixed"
$dateCustom = Get-VstsInput -Name "dateCustom"
$timeFixed = Get-VstsInput -Name "timeFixed"
$timeCustom = Get-VstsInput -Name "timeCustom"
$parallel = Get-VstsInput -Name "parallel"


$p = checkParallel -Value $parallel
$startDateTime = convertToDateTime  -TimeZone $timeZone `
                                    -DateFixed $dateChoose -DateCustom $dateCustom `
                                    -TimeFixed $timeFixed -TimeCustom $timeCustom

$adf = getAzureDataFactory -ResourceGroupName $resourceGroupName -DataFactoryName $adfname


Write-Host "Set schedule for '$adfname' pipelines"