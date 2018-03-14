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
$windowUnit = Get-VstsInput -Name "windowUnit" -Require
$windowLength = Get-VstsInput -Name "windowLength" -Require

$endWindow = getEndWindow
$startWindow = getStartWindow -EndWindow $endWindow -WindowUnit $windowUnit -WindowLength $windowLength

$adf = getAzureDataFactory -ResourceGroupName $resourceGroupName -DataFactoryName $adfname

$result = setPipelineActivityWindow -DataFactory $adf -
Write-Host "Set schedule for '$adfname' pipelines"