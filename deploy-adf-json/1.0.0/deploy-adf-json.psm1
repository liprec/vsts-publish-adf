<#
.SYNOPSIS
Checks and return the parameter as integer

.DESCRIPTION
Helper function to check if the provided parameter is a number and returns that number.
If the value is not a number, a 1 is returned

.PARAMETER Value
String variable holding a number

.EXAMPLE
$i = checkParallel -Value '5'
#>
function checkParallel([string]$Value) {
    if ($Value -as [int]) {
        return $Value
    } else {
        return 1
    }
}

<#
.SYNOPSIS
Function to return the Azure Data Factory object

.DESCRIPTION
Helper function to return the Azure Data Factory object based on a resourcegroup and datafactory name

.PARAMETER ResourceGroupName
Resource Group name

.PARAMETER DataFactory
Data Factory name

.EXAMPLE
$adf = getAzureDataFactory -ResourceGroupName 'resourceGroup' -DataFactoryName 'datafactory'
#>
function getAzureDataFactory([string]$ResourceGroupName, [string]$DataFactoryName) {
    $DataFactory = Get-AzureRmDataFactory -ResourceGroupName $ResourceGroupName -Name $DataFactoryName
    
    if (!$DataFactory) {
        throw "Azure Data Factory '$DataFactoryName' could not be found in Resourse Group '$ResourceGroupName'"
    } 

    return $DataFactory
}

<#
.SYNOPSIS
Gets the friendly name

.DESCRIPTION
Gets the friendly name of the value of the provided DeployType enum

.PARAMETER DeployType
Value of enum DeployType

.EXAMPLE
getFriendlyName -DeployType 0 #linkedservice
#>
function getFriendlyName([int]$DeployType) {
    #Define friendly name
    switch ($DeployType) {
        0 {
            return "Linked Service"
        }
        1 {
            return "Dataset"
        }
        2 {
            return "Pipeline"
        }
    }
}

<#
.SYNOPSIS
Short description

.DESCRIPTION
Long description

.PARAMETER DataFactory
Parameter description

.PARAMETER DeployType
Parameter description

.PARAMETER Path
Parameter description

.EXAMPLE
An example
#>
function clearExisting($DataFactory, [int]$DeployType, [string]$Path) {
    # Check if the $Path parameter is filled with a value related to artifacts 
    if ([string]::IsNullOrWhitespace($Path) -eq $false `
                -and $Path -ne $env:SYSTEM_DEFAULTWORKINGDIRECTORY `
                -and $Path -ne [String]::Concat($env:SYSTEM_DEFAULTWORKINGDIRECTORY, "\")) {
        
        $friendlyName = getFriendlyName($DeployType)

        switch ($DeployType) {
            0 { #linkedservice
                $linkedServices = Get-AzureRmDataFactoryLinkedService -DataFactory $DataFactory
                foreach($linkedService in $linkedServices) {
                    $result = Remove-AzureRmDataFactoryLinkedService -DataFactory $DataFactory -Name $linkedService.LinkedServiceName -Force
                }
                $return = $linkedServices.Count
            }
            1 { #dataset
                $dataSets = Get-AzureRmDataFactoryDataset -DataFactory $DataFactory
                foreach($dataSet in $dataSets) {
                    $result = Remove-AzureRmDataFactoryDataset -DataFactory $DataFactory -Name $dataSet.DatasetName -Force
                }
                $return = $dataSets.Count
            }
            2 { #pipeline
                $pipeLines = Get-AzureRmDataFactoryPipeline -DataFactory $DataFactory
                foreach($pipeLine in $pipeLines) {
                    $result = Remove-AzureRmDataFactoryPipeline -DataFactory $DataFactory -Name $pipeLine.PipelineName -Force
                }
                $return = $pipeLines.Count
            }
        }

        Write-Host "Cleared all existing $friendlyName"
        return $return
    } else {
        return -1
    }
}

<#
.SYNOPSIS
Short description

.DESCRIPTION
Long description

.PARAMETER DataFactory
Parameter description

.PARAMETER DeployType
Parameter description

.PARAMETER Path
Parameter description

.PARAMETER Overwrite
Parameter description

.PARAMETER Continue
Parameter description

.EXAMPLE
An example
#>
function deploy($DataFactory, [int]$DeployType, [string]$Path, [boolean]$Overwrite, [boolean]$Continue, [int]$Parallel) {
    # Check if the $Path parameter is filled with a value related to artifacts 
    if ([string]::IsNullOrWhitespace($Path) -eq $false `
                -and $Path -ne $env:SYSTEM_DEFAULTWORKINGDIRECTORY `
                -and $Path -ne [String]::Concat($env:SYSTEM_DEFAULTWORKINGDIRECTORY, "\")) {
        
        $friendlyName = getFriendlyName($DeployType)

        Write-Host "Start deploying $friendlyName"

        $jsonFiles = Get-ChildItem -Path $Path -Filter '*.json'
        $jsonFilesCount = $jsonFiles.Length

        Write-Host "Found $jsonFilesCount $friendlyName files"

        foreach ($json in $jsonFiles) {
            $result = deployJson -DataFactory $DataFactory -DeployType $DeployType -Json $json -Overwrite $Overwrite -Continue $Continue -Clear $Clear
            Write-Host $result
        }
    } else {
        return -1
    }

    return 0
}

<#
.SYNOPSIS
Short description

.DESCRIPTION
Long description

.PARAMETER DataFactory
Parameter description

.PARAMETER JsonFile
Parameter description

.PARAMETER Overwrite
Parameter description

.EXAMPLE
An example
#>
function deployLinkedServiceJSON($DataFactory, $JsonFile, $Overwrite) {
    if ($Overwrite) {
        $result = New-AzureRmDataFactoryLinkedService -DataFactory $DataFactory -File $JsonFile -Force
    } else {
        $result = New-AzureRmDataFactoryLinkedService -DataFactory $DataFactory -File $JsonFile
    }

    return $result
}

<#
.SYNOPSIS
Short description

.DESCRIPTION
Long description

.PARAMETER DataFactory
Parameter description

.PARAMETER JsonFile
Parameter description

.PARAMETER Overwrite
Parameter description

.EXAMPLE
An example
#>
function deployDatasetJSON($DataFactory, $JsonFile, $Overwrite) {
    if ($Overwrite) {
        $result = New-AzureRmDataFactoryDataset -DataFactory $DataFactory -File $JsonFile -Force
    } else {
        $result = New-AzureRmDataFactoryDataset -DataFactory $DataFactory -File $JsonFile
    }

    return $result
}

<#
.SYNOPSIS
Short description

.DESCRIPTION
Long description

.PARAMETER DataFactory
Parameter description

.PARAMETER JsonFile
Parameter description

.PARAMETER Overwrite
Parameter description

.EXAMPLE
An example
#>
function deployPipelineJSON($DataFactory, $JsonFile, $Overwrite) {
    if ($Overwrite) {
        $result = New-AzureRmDataFactoryPipeline -DataFactory $DataFactory -File $JsonFile -Force
    } else {
        $result = New-AzureRmDataFactoryPipeline -DataFactory $DataFactory -File $JsonFile
    }

    return $result
}

<#
.SYNOPSIS
Short description

.DESCRIPTION
Long description

.PARAMETER DataFactory
Parameter description

.PARAMETER DeployType
Parameter description

.PARAMETER Json
Parameter description

.PARAMETER Overwrite
Parameter description

.PARAMETER Continue
Parameter description

.EXAMPLE
An example
#>
function deployJson($DataFactory, [int]$DeployType, $Json, [boolean]$Overwrite, [boolean]$Continue) {
    $friendlyName = getFriendlyName($DeployType)
    $jsonFile = $Json.Name
    $jsonPath = $Json.FullName

    try {
        switch ($DeployType) {
            0 {  #linkedservice
                $result = deployLinkedServiceJSON -DataFactory $DataFactory -JsonFile $jsonPath -Overwrite $Overwrite
            }
            1 {  #dataset
                $result = deployDatasetJSON -DataFactory $DataFactory -JsonFile $jsonPath -Overwrite $Overwrite
            }
            2 { #pipeline
                $result = deployPipelineJSON -DataFactory $DataFactory -JsonFile $jsonPath -Overwrite $Overwrite
            }
        }
        $resultState = $result.ProvisioningState
        return "Deploy $friendlyName '$jsonFile' : $resultState" 
    } catch {
        if (!$Continue) {
            throw "Error deploying '$jsonFile' : $resultStat"
        } else {
            return "Error deploying '$jsonFile' : $resultState"
        }
    }
}

Export-ModuleMember -Function *