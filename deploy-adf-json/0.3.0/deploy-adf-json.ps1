[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation

$linkedModule = (Split-Path -Leaf $MyInvocation.MyCommand.Path).Replace('.ps1', '.psm1')

# Import the logic of the linked module
Import-Module $PSScriptRoot\$linkedModule -Force
Import-Module $PSScriptRoot\ps_modules\VstsAzureHelpers_
Initialize-Azure

$resourceGroupName = Get-VstsInput -Name "resourceGroupName" -Require
$adfname = Get-VstsInput -Name "adfname" -Require
$pathToServices = Get-VstsInput -Name "pathToServices"
$pathToDataSets = Get-VstsInput -Name "pathToDataSets"
$pathToPipelines = Get-VstsInput -Name "pathToPipelines"

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

$adf = getAzureDataFactory -ResourceGroupName $resourceGroupName -DataFactoryName $adfname

# Deployment new definitions
$deployType = 0 #linkedservice
$result = deploy -DataFactory $adf -DeployType $deployType -Path $pathToServices -Overwrite $overwrite -Continue $continue -Clear $clear -Parallel $parallel

$deployType = 1 #dataset
$result = deploy -DataFactory $adf -DeployType $deployType -Path $pathToDataSets -Overwrite $overwrite -Continue $continue -Clear $clear -Parallel $parallel

$deployType = 2 #pipeline
$result = deploy -DataFactory $adf -DeployType $deployType -Path $pathToPipelines -Overwrite $overwrite -Continue $continue -Clear $clear -Parallel $parallel

Write-Host "Deploy JSON files to $adfname complete"