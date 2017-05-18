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
    Write-VstsTaskError -Message "Azure Data Factory '$adfname' could not be found in Resourse Group '$resourceGroupName'"
    throw "Azure Data Factory '$adfname' could not be found in Resourse Group '$resourceGroupName'"
} 

# Linked services
if (!$pathToServices) {
    $jsonFiles = Get-ChildItem $pathToServices -Filter *.json
    $jsonFilesCount = $jsonFiles.Length

    Write-VstsSetProgress -Percent 25
    Write-VstsTaskVerbose -Message "Deploying $jsonFilesCount linked services files"
    foreach($json in $jsonFiles) {
        try {
            if ($overwrite) {
                New-AzureRmDataFactoryLinkedService -DataFactory $adf -File $json -Force
            } else {
                New-AzureRmDataFactoryLinkedService -DataFactory $adf -File $json
            }
        } catch {
            Write-VstsTaskError -Message "Error deploying linked service file: '$json'"
            throw " Error deploying linked service file: '$json'"
        }
    }
}

# Datasets
if (!$pathToDataSets ) {
    $jsonFiles = Get-ChildItem $pathToDataSets -Filter *.json
    $jsonFilesCount = $jsonFiles.Length

    Write-VstsSetProgress -Percent 50
    Write-VstsTaskVerbose -Message "Deploying $jsonFilesCount input dataset files"
    foreach($json in $jsonFiles) {
        try {
            if ($overwrite) {
                New-AzureRmDataFactoryDataset -DataFactory $adf -File $json -Force
            } else {
                New-AzureRmDataFactoryDataset -DataFactory $adf -File $json
            }
        } catch {
            Write-VstsTaskError -Message "Error deploying dataset: '$json'"
            throw " Error deploying dataset: '$json'"
        }
    }
}

# Pipelines
if (!$pathToPipelines) {
    $jsonFiles = Get-ChildItem $pathToPipelines -Filter *.json
    $jsonFilesCount = $jsonFiles.Length

    Write-VstsSetProgress -Percent 75
    Write-VstsTaskVerbose -Message "Deploying $jsonFilesCount pipeline files"
    foreach($json in $jsonFiles) {
        try {
            if ($overwrite) {
                New-AzureRmDataFactoryPipeline -DataFactory $adf -File $json -Force
            } else {
                New-AzureRmDataFactoryPipeline -DataFactory $adf -File $json
            }
        } catch {
            Write-VstsTaskError -Message "Error deploying pipeline: '$json'"
            throw " Error deploying pipeline: '$json'"
        }
    }
}

Write-VstsSetProgress -Percent 100
Write-VstsTaskVerbose -Message "Deploying complete"