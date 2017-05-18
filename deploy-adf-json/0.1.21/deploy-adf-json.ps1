[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation

Import-Module $PSScriptRoot\ps_modules\VstsAzureHelpers_
Initialize-Azure

$resourceGroupName = Get-VstsInput -Name "resourceGroupName" -Require
$adfname = Get-VstsInput -Name "adfname" -Require
$pathToServices = Get-VstsInput -Name "pathToServices"
$pathToDataSets = Get-VstsInput -Name "pathToDataSets"
$pathToPipelines = Get-VstsInput -Name "pathToPipelines"
$overwrite = Get-VstsInput -Name "overwrite" -Require
$continue = Get-VstsInput -Name "continue" -Require

# This is a hack since the agent passes this as a string.
if($overwrite -eq "true"){
    $overwrite = $true
}else{
    $overwrite = $false
}

if($continue -eq "true"){
    $continue = $true
}else{
    $continue = $false
}

$adf = Get-AzureRmDataFactory -ResourceGroupName $resourceGroupName -Name $adfname

if (!$adf) {
    throw "Azure Data Factory '$adfname' could not be found in Resourse Group '$resourceGroupName'"
} 

# Linked services
if ([string]::IsNullOrWhitespace($pathToServices) -eq $false `
            -and $pathToServices -ne $env:SYSTEM_DEFAULTWORKINGDIRECTORY `
            -and $pathToServices -ne [String]::Concat($env:SYSTEM_DEFAULTWORKINGDIRECTORY, "\")) {
    Write-Host "Start deploying Linked Services"

    $jsonFiles = Get-ChildItem -Path $pathToServices -Filter '*.json'
    $jsonFilesCount = $jsonFiles.Length

    Write-Host "Found $jsonFilesCount linked services files"
    foreach($json in $jsonFiles) {
        try {
            if ($overwrite) {
                $result = New-AzureRmDataFactoryLinkedService -DataFactory $adf -File $json.FullName -Force
            } else {
                $result = New-AzureRmDataFactoryLinkedService -DataFactory $adf -File $json.FullName
            }
            $resultState = $result.ProvisioningState
            Write-Host "Deploy Linked Service $json : $resultState"
        } catch {
            if (!$continue) {
                throw "Error deploying Linked Service: '$json'"
            } else {
                Write-Host "Error deploying Linked Service: '$json'"
            }
        }
    }
}

# Datasets
if ([string]::IsNullOrWhitespace($pathToDatasets) -eq $false`
            -and $pathToDatasets -ne $env:SYSTEM_DEFAULTWORKINGDIRECTORY `
            -and $pathToDatasets -ne [String]::Concat($env:SYSTEM_DEFAULTWORKINGDIRECTORY, "\")) {
    Write-Host "Start deploying Datasets"

    $jsonFiles = Get-ChildItem -Path $pathToDatasets -Filter *.json
    $jsonFilesCount = $jsonFiles.Length

    Write-Host "Found $jsonFilesCount Dataset files"
    foreach($json in $jsonFiles) {
        try {
            if ($overwrite) {
                $result = New-AzureRmDataFactoryDataset -DataFactory $adf -File $json.FullName -Force
            } else {
                $result = New-AzureRmDataFactoryDataset -DataFactory $adf -File $json.FullName
            }
            $resultState = $result.ProvisioningState
            Write-Host "Deploy Dataset $json : $resultState"
        } catch {
            if (!$continue) {
                throw "Error deploying Dataset: '$json'"
            } else {
                Write-Host "Error deploying Dataset: '$json'"
            }
        }
    }
}

# Pipelines
if ([string]::IsNullOrWhitespace($pathToPipelines) -eq $false`
            -and $pathToPipelines -ne $env:SYSTEM_DEFAULTWORKINGDIRECTORY `
            -and $pathToPipelines -ne [String]::Concat($env:SYSTEM_DEFAULTWORKINGDIRECTORY, "\")) {
    Write-Host "Start deploying Pipelines"

    $jsonFiles = Get-ChildItem -Path $pathToPipelines -Filter '*.json'
    $jsonFilesCount = $jsonFiles.Length

    Write-Host "Found $jsonFilesCount Pipeline files"
    foreach($json in $jsonFiles) {
        try {
            if ($overwrite) {
                $result = New-AzureRmDataFactoryPipeline -DataFactory $adf -File $json.FullName -Force
            } else {
                $result = New-AzureRmDataFactoryPipeline -DataFactory $adf -File $json.FullName
            }
            $resultState = $result.ProvisioningState
            Write-Host "Deploy Pipeline $json : $resultState"
        } catch {
            if (!$continue) {
                throw "Error deploying Pipeline: '$json'"
            } else {
                Write-Host "Error deploying Pipeline: '$json'"
            }
        }
    }
}

Write-Host "Deploying complete"