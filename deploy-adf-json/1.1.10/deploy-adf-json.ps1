[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation

$linkedModule = (Split-Path -Leaf $MyInvocation.MyCommand.Path).Replace('.ps1', '.psm1')

# Import the logic of the linked module
Import-Module $PSScriptRoot\$linkedModule -Force
Import-Module $PSScriptRoot\ps_modules\VstsAzureHelpers_

#ADF Version
$adfversion = Get-VstsInput -Name "adfversion" -Require
# is V2?
if ($adfversion -eq "V2") {
    Import-Module $PSScriptRoot\ps_modules\AzureRM.profile
    Import-Module $PSScriptRoot\ps_modules\AzureRM.DataFactoryV2
}
Initialize-Azure

$resourceGroupName = Get-VstsInput -Name "resourceGroupName" -Require
$adfname = Get-VstsInput -Name "adfname" -Require


$pathToServices = Get-VstsInput -Name "pathToServices"
$pathToDataSets = Get-VstsInput -Name "pathToDataSets"
$pathToPipelines = Get-VstsInput -Name "pathToPipelines"
$pathToTriggers = Get-VstsInput -Name "pathToTriggers"

$overwrite = Get-VstsInput -Name "overwrite" -Require
$continue = Get-VstsInput -Name "continue" -Require
$clear = Get-VstsInput -Name "clear" -Require
$parallel = Get-VstsInput -Name "parallel"

# This is a hack since the agent passes this as a string.
if ($overwrite -eq "true") {
    $overwrite = $true
} else {
    $overwrite = $false
}

if ($continue -eq "true") {
    $continue = $true
} else {
    $continue = $false
}

if ($clear -eq "true") {
    $clear = $true
} else {
    $clear = $false
}

$parallel = checkParallel -Value $parallel

$adf = getAzureDataFactory -ResourceGroupName $resourceGroupName -DataFactoryName $adfname -Version $adfversion

# Clear old definitions
if ($clear) {
    $deployType = 3 #trigger
    $result = clearExisting -DataFactory $adf -DeployType $deployType -Path $pathToTriggers  -Version $adfversion

    $deployType = 2 #pipeline
    $result = clearExisting -DataFactory $adf -DeployType $deployType -Path $pathToPipelines -Version $adfversion

    $deployType = 1 #dataset
    $result = clearExisting -DataFactory $adf -DeployType $deployType -Path $pathToDataSets -Version $adfversion

    $deployType = 0 #linkedservice
    $result = clearExisting -DataFactory $adf -DeployType $deployType -Path $pathToServices -Version $adfversion
}

# Deployment new definitions
$deployType = 0 #linkedservice
$result = deploy -DataFactory $adf -Version $adfversion -DeployType $deployType -Path $pathToServices -Overwrite $overwrite -Continue $continue -Parallel $parallel

$deployType = 1 #dataset
$result = deploy -DataFactory $adf -Version $adfversion -DeployType $deployType -Path $pathToDataSets -Overwrite $overwrite -Continue $continue -Parallel $parallel

$deployType = 2 #pipeline
$result = deploy -DataFactory $adf -Version $adfversion -DeployType $deployType -Path $pathToPipelines -Overwrite $overwrite -Continue $continue -Parallel $parallel

$deployType = 3 #trigger
$result = deploy -DataFactory $adf -Version $adfversion -DeployType $deployType -Path $pathToTriggers -Overwrite $overwrite -Continue $continue -Parallel $parallel

Write-Host "Deploy JSON files to $adfname complete"