[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation

$linkedModule = (Split-Path -Leaf $MyInvocation.MyCommand.Path).Replace('.ps1', '.psm1')

# Import the logic of the linked module
Import-Module $PSScriptRoot\$linkedModule -Force
Import-Module $PSScriptRoot\ps_modules\VstsAzureHelpers_
Import-Module $PSScriptRoot\ps_modules\AzureRM.profile
Import-Module $PSScriptRoot\ps_modules\AzureRM.DataFactoryV2
Initialize-Azure

$resourceGroupName = Get-VstsInput -Name "resourceGroupName" -Require
$adfName = Get-VstsInput -Name "adfName" -Require
$triggerName = Get-VstsInput -Name "triggerName"
$triggerStatus = Get-VstsInput -Name "triggerStatus" -Require

$continue = Get-VstsInput -Name "continue" -Require

if ($continue -eq "true") {
    $continue = $true
} else {
    $continue = $false
}

$result = setTriggerStatus -ResourceGroupName $resourceGroupName -DataFactoryName $adfName -TriggerName $triggerName -TriggerStatus $triggerStatus -Continue $continue

Write-Host "'$result' trigger(s) in '$adfname' set to '$triggerStatus' complete"