Write-Verbose 'Entering script deploy-json.ps1'

Import-Module $PSScriptRoot\ps_modules\VstsAzureHelpers_
Initialize-Azure

$resourceGroupName = Get-VstsInput -Name resourceGroupName -Require
$adfname = Get-VstsInput -Name adfname -Require
$pathToServices = Get-VstsInput -Name pathToServices
$pathToDataSets = Get-VstsInput -Name pathToDataSets
$pathToPipelines = Get-VstsInput -Name pathToPipelines
$overwrite = Get-VstsInput -Name overwrite -Require

# This is a hack since the agent passes this as a string.
if($overwrite -eq "true"){
    $overwrite = $true
}else{
    $overwrite = $false
}

$adf = Get-AzureRmDataFactory -ResourceGroupName $resourceGroupName -Name $adfname

if (!$adf) {
    Write-Host "##vso[task.logissue type=error;] Azure Data Factory '$adfname' could not be found in Resourse Group '$resourceGroupName'"
    throw "Azure Data Factory '$adfname' could not be found in Resourse Group '$resourceGroupName'"
} 

# Linked services
if (!$pathToServices) {
    $jsonFiles = Get-ChildItem $pathToServices -Filter *.json
    $jsonFilesCount = $jsonFiles.Length

    Write-Host "##vso[task.setprogress value=25;] Deploying $jsonFilesCount linked services files"
    foreach($json in $jsonFiles) {
        try {
            if ($overwrite) {
                New-AzureRmDataFactoryLinkedService -DataFactory $adf -File $json -Force
            } else {
                New-AzureRmDataFactoryLinkedService -DataFactory $adf -File $json
            }
        } catch {
            Write-Host "##vso[task.logissue type=error;] Error deploying linked service file: '$json'"
            throw " Error deploying linked service file: '$json'"
        }
    }
}

# Datasets
if (!$pathToDataSets ) {
    $jsonFiles = Get-ChildItem $pathToDataSets -Filter *.json
    $jsonFilesCount = $jsonFiles.Length

    Write-Host "##vso[task.setprogress value=50;] Deploying $jsonFilesCount input dataset files"
    foreach($json in $jsonFiles) {
        try {
            if ($overwrite) {
                New-AzureRmDataFactoryDataset -DataFactory $adf -File $json -Force
            } else {
                New-AzureRmDataFactoryDataset -DataFactory $adf -File $json
            }
        } catch {
            Write-Host "##vso[task.logissue type=error;] Error deploying dataset: '$json'"
            throw " Error deploying dataset: '$json'"
        }
    }
}

# Pipelines
if (!$pathToPipelines) {
    $jsonFiles = Get-ChildItem $pathToPipelines -Filter *.json
    $jsonFilesCount = $jsonFiles.Length

    Write-Host "##vso[task.setprogress value=75;] Deploying $jsonFilesCount pipeline files"
    foreach($json in $jsonFiles) {
        try {
            if ($overwrite) {
                New-AzureRmDataFactoryPipeline -DataFactory $adf -File $json -Force
            } else {
                New-AzureRmDataFactoryPipeline -DataFactory $adf -File $json
            }
        } catch {
            Write-Host "##vso[task.logissue type=error;] Error deploying pipeline: '$json'"
            throw " Error deploying pipeline: '$json'"
        }
    }
}

Write-Host "##vso[task.setprogress value=100;] Deploying complete"