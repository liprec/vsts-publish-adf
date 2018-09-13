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
function getAzureDataFactory([string]$ResourceGroupName, [string]$DataFactoryName, [string]$Version) {
    switch ($Version) {
        "V2" {
            $DataFactory = Get-AzureRmDataFactoryV2 -ResourceGroupName $ResourceGroupName -Name $DataFactoryName
        }
        default {
            $DataFactory = Get-AzureRmDataFactory -ResourceGroupName $ResourceGroupName -Name $DataFactoryName
        }
    }
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
        3 {
            return "Trigger"
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
function clearExisting($DataFactory, [int]$DeployType, [string]$Version, [string]$Path) {
    # Check if the $Path parameter is filled with a value related to artifacts 
    if ([string]::IsNullOrWhitespace($Path) -eq $false `
                -and $Path -ne $env:SYSTEM_DEFAULTWORKINGDIRECTORY `
                -and $Path -ne [String]::Concat($env:SYSTEM_DEFAULTWORKINGDIRECTORY, "\")) {
        
        $friendlyName = getFriendlyName($DeployType)

        switch ($DeployType) {
            0 { #linkedservice
                $return = clearLinkedService -ResourceGroupName $DataFactory.ResourceGroupName -DataFactoryName $DataFactory.DataFactoryName -Version $Version
            }
            1 { #dataset
                $return = clearDataset -ResourceGroupName $DataFactory.ResourceGroupName -DataFactoryName $DataFactory.DataFactoryName -Version $Version
            }
            2 { #pipeline
                $return = clearPipeline -ResourceGroupName $DataFactory.ResourceGroupName -DataFactoryName $DataFactory.DataFactoryName -Version $Version
            }
            3 { #trigger
                $return = clearTrigger -ResourceGroupName $DataFactory.ResourceGroupName -DataFactoryName $DataFactory.DataFactoryName -Version $Version
            }
        }

        Write-Host "Cleared all existing $friendlyName"
        return $return
    } else {
        return -1
    }
}

<###############################
#.SYNOPSIS
#Short description
#
#.DESCRIPTION
#Long description
#
#.PARAMETER DataFactory
#Parameter description
#
#.PARAMETER Version
#Parameter description
#
#.EXAMPLE
#An example
#
#.NOTES
#General notes
###############################>
function clearLinkedService($ResourceGroupName, $DataFactoryName, $Version) {
    switch ($Version) {
        "V2" {
            $linkedServices = Get-AzureRmDataFactoryV2LinkedService -ResourceGroupName $ResourceGroupName -DataFactoryName $DataFactoryName
            foreach($linkedService in $linkedServices) {
                $name = $linkedService.Name
                $result = Remove-AzureRmDataFactoryV2LinkedService -ResourceGroupName $ResourceGroupName -DataFactoryName $DataFactoryName -Name $name -Force
            }
        }
        default {
            $linkedServices = Get-AzureRmDataFactoryLinkedService -ResourceGroupName $ResourceGroupName -DataFactoryName $DataFactoryName
            foreach($linkedService in $linkedServices) {
                $result = Remove-AzureRmDataFactoryLinkedService -ResourceGroupName $ResourceGroupName -DataFactoryName $DataFactoryName -Name $linkedService.LinkedServiceName -Force
            }
        }
    }
    return $linkedServices.Count;
}

<###############################
#.SYNOPSIS
#Short description
#
#.DESCRIPTION
#Long description
#
#.PARAMETER ResourceGroupName
#Parameter description
#
#.PARAMETER DataFactoryName
#Parameter description
#
#.PARAMETER DataFactory
#Parameter description
#
#.PARAMETER Version
#Parameter description
#
#.EXAMPLE
#An example
#
#.NOTES
#General notes
###############################>
function clearDataset($ResourceGroupName, $DataFactoryName, $Version) {
    switch ($Version) {
        "V2" {
            $datasets = Get-AzureRmDataFactoryV2Dataset -ResourceGroupName $ResourceGroupName -DataFactoryName $DataFactoryName
            foreach($dataset in $datasets) {
                $name = $dataset.Name
                $result = Remove-AzureRmDataFactoryV2Dataset -ResourceGroupName $ResourceGroupName -DataFactoryName $DataFactoryName -Name $name -Force
            }
        }
        default {
            $datasets = Get-AzureRmDataFactoryDataset -ResourceGroupName $ResourceGroupName -DataFactoryName $DataFactoryName
            foreach($dataset in $datasets) {
                $result = Remove-AzureRmDataFactoryDataset -ResourceGroupName $ResourceGroupName -DataFactoryName $DataFactoryName -Name $dataset.DatasetName -Force
            }
        }
    }
    return $datasets.Count;
}

<###############################
#.SYNOPSIS
#Short description
#
#.DESCRIPTION
#Long description
#
#.PARAMETER ResourceGroupName
#Parameter description
#
#.PARAMETER DataFactoryName
#Parameter description
#
#.PARAMETER DataFactory
#Parameter description
#
#.PARAMETER Version
#Parameter description
#
#.EXAMPLE
#An example
#
#.NOTES
#General notes
###############################>
function clearPipeline($ResourceGroupName, $DataFactoryName, $Version) {
    switch ($Version) {
        "V2" {
            $pipelines = Get-AzureRmDataFactoryV2Pipeline -ResourceGroupName $ResourceGroupName -DataFactoryName $DataFactoryName
            foreach($pipeline in $pipelines) {
                $name = $pipeline.Name
                $result = Remove-AzureRmDataFactoryV2Pipeline -ResourceGroupName $ResourceGroupName -DataFactoryName $DataFactoryName -Name $name -Force
            }
        }
        default {
            $pipelines = Get-AzureRmDataFactoryPipeline -ResourceGroupName $ResourceGroupName -DataFactoryName $DataFactoryName
            foreach($pipeline in $pipelines) {
                $result = Remove-AzureRmDataFactoryPipeline -ResourceGroupName $ResourceGroupName -DataFactoryName $DataFactoryName -Name $pipeline.PipelineName -Force
            }
        }
    }
    return $pipelines.Count;
}

<###############################
#.SYNOPSIS
#Short description
#
#.DESCRIPTION
#Long description
#
#.PARAMETER ResourceGroupName
#Parameter description
#
#.PARAMETER DataFactoryName
#Parameter description
#
#.PARAMETER DataFactory
#Parameter description
#
#.PARAMETER Version
#Parameter description
#
#.EXAMPLE
#An example
#
#.NOTES
#General notes
###############################>
function clearTrigger($ResourceGroupName, $DataFactoryName, $Version) {
    switch ($Version) {
        "V2" {
            $triggers = Get-AzureRmDataFactoryV2Trigger -ResourceGroupName $ResourceGroupName -DataFactoryName $DataFactoryName
            foreach($trigger in $triggers) {
                $name = $trigger.Name
                $result = Remove-AzureRmDataFactoryV2Trigger -ResourceGroupName $ResourceGroupName -DataFactoryName $DataFactoryName -Name $name -Force
            }
        }
    }
    return $triggers.Count;
}

<###############################
#.SYNOPSIS
#Short description
#
#.DESCRIPTION
#Long description
#
#.PARAMETER DataFactory
#Parameter description
#
#.PARAMETER DeployType
#Parameter description
#
#.PARAMETER Version
#Parameter description
#
#.PARAMETER Path
#Parameter description
#
#.PARAMETER Overwrite
#Parameter description
#
#.PARAMETER Continue
#Parameter description
#
#.PARAMETER Parallel
#Parameter description
#
#.EXAMPLE
#An example
#
#.NOTES
#General notes
###############################>
function deploy($DataFactory, [int]$DeployType, [string]$Version, [string]$Path, [boolean]$Overwrite, [boolean]$Continue, [int]$Parallel) {
    # Check if the $Path parameter is filled with a value related to artifacts 
    if ([string]::IsNullOrWhitespace($Path) -eq $false `
                -and $Path -ne $env:SYSTEM_DEFAULTWORKINGDIRECTORY `
                -and $Path -ne [String]::Concat($env:SYSTEM_DEFAULTWORKINGDIRECTORY, "\")) {
        
        $friendlyName = getFriendlyName($DeployType)

        Write-Host "Start deploying $friendlyName"

        $jsonFiles = Get-ChildItem -Path $Path -Filter '*.json'
        $jsonFilesCount = $jsonFiles.Count

        Write-Host "Found $jsonFilesCount $friendlyName files"

        foreach ($json in $jsonFiles) {
            $result = deployJson -DataFactory $DataFactory -DeployType $DeployType -Version $Version -Json $json -Overwrite $Overwrite -Continue $Continue -Clear $Clear
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
function deployLinkedServiceJSON($ResourceGroupName, $DataFactoryName, $Version, $JsonFile, $Overwrite) {
    switch ($Version) {
        "V2" {
            $linkedServiceName = (Get-Content $JsonFile | ConvertFrom-Json).name
            if ($Overwrite) {
                $result = Set-AzureRmDataFactoryV2LinkedService -ResourceGroupName $ResourceGroupName -DataFactoryName $DataFactoryName -Name $linkedServiceName -File $JsonFile.FullName -Force
            } else {
                $result = Set-AzureRmDataFactoryV2LinkedService -ResourceGroupName $ResourceGroupName -DataFactoryName $DataFactoryName -Name $linkedServiceName -File $JsonFile.FullName
            }
        }
        default {
            if ($Overwrite) {
                $result = New-AzureRmDataFactoryLinkedService -ResourceGroupName $ResourceGroupName -DataFactoryName $DataFactoryName -File $JsonFile.FullName -Force
            } else {
                $result = New-AzureRmDataFactoryLinkedService -ResourceGroupName $ResourceGroupName -DataFactoryName $DataFactoryName -File $JsonFile.FullName
            }
        }
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
function deployDatasetJSON($ResourceGroupName, $DataFactoryName, $Version, $JsonFile, $Overwrite) {
    switch ($Version) {
        "V2" {
            $datasetName = (Get-Content $JsonFile | ConvertFrom-Json).name
            if ($Overwrite) {
                $result = Set-AzureRmDataFactoryV2Dataset -ResourceGroupName $ResourceGroupName -DataFactoryName $DataFactoryName -Name $datasetName -File $JsonFile.FullName -Force
            } else {
                $result = Set-AzureRmDataFactoryV2Dataset -ResourceGroupName $ResourceGroupName -DataFactoryName $DataFactoryName -Name $datasetName -File $JsonFile.FullName
            }
        }
        default {
            if ($Overwrite) {
                $result = New-AzureRmDataFactoryDataset -ResourceGroupName $ResourceGroupName -DataFactoryName $DataFactoryName -File $JsonFile.FullName -Force
            } else {
                $result = New-AzureRmDataFactoryDataset -ResourceGroupName $ResourceGroupName -DataFactoryName $DataFactoryName -File $JsonFile.FullName
            }
        }
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
function deployPipelineJSON($ResourceGroupName, $DataFactoryName, $Version, $JsonFile, $Overwrite) {
    switch ($Version) {
        "V2" {
            $pipelineName = (Get-Content $JsonFile | ConvertFrom-Json).name
            if ($Overwrite) {
                $result = Set-AzureRmDataFactoryV2Pipeline -ResourceGroupName $ResourceGroupName -DataFactoryName $DataFactoryName -Name $pipelineName -File $JsonFile.FullName -Force
            } else {
                $result = Set-AzureRmDataFactoryV2Pipeline -ResourceGroupName $ResourceGroupName -DataFactoryName $DataFactoryName -Name $pipelineName -File $JsonFile.FullName
            }
        }
        default {
            if ($Overwrite) {
                $result = New-AzureRmDataFactoryPipeline -ResourceGroupName $ResourceGroupName -DataFactoryName $DataFactoryName -File $JsonFile.FullName -Force
            } else {
                $result = New-AzureRmDataFactoryPipeline -ResourceGroupName $ResourceGroupName -DataFactoryName $DataFactoryName -File $JsonFile.FullName
            }
        }
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
function deployTriggerJSON($ResourceGroupName, $DataFactoryName, $Version, $JsonFile, $Overwrite) {
    switch ($Version) {
        "V2" { 
            $triggerName = (Get-Content $JsonFile | ConvertFrom-Json).name
            if ($Overwrite) {
                $result = Set-AzureRmDataFactoryV2Trigger -ResourceGroupName $ResourceGroupName -DataFactoryName $DataFactoryName -Name $triggerName -File $JsonFile.FullName -Force
            } else {
                $result = Set-AzureRmDataFactoryV2Trigger -ResourceGroupName $ResourceGroupName -DataFactoryName $DataFactoryName -Name $triggerName -File $JsonFile.FullName
            }
        }
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
function deployJson($DataFactory, [string]$Version, [int]$DeployType, $Json, [boolean]$Overwrite, [boolean]$Continue) {
    $friendlyName = getFriendlyName($DeployType)
    $jsonFile = $Json.Name

    try {
        switch ($DeployType) {
            0 {  #linkedservice
                $result = deployLinkedServiceJSON -ResourceGroupName $DataFactory.ResourceGroupName -DataFactoryName $DataFactory.DataFactoryName -Version $Version -JsonFile $Json -Overwrite $Overwrite
            }
            1 {  #dataset
                $result = deployDatasetJSON -ResourceGroupName $DataFactory.ResourceGroupName -DataFactoryName $DataFactory.DataFactoryName -Version $Version -JsonFile $Json -Overwrite $Overwrite
            }
            2 { #pipeline
                $result = deployPipelineJSON -ResourceGroupName $DataFactory.ResourceGroupName -DataFactoryName $DataFactory.DataFactoryName -Version $Version -JsonFile $Json -Overwrite $Overwrite
            }
            3 { #trigger
                $result = deployTriggerJSON -ResourceGroupName $DataFactory.ResourceGroupName -DataFactoryName $DataFactory.DataFactoryName -Version $Version -JsonFile $Json -Overwrite $Overwrite
            }
        }
        $resultState = $result.ProvisioningState
        return "Deploy $friendlyName '$jsonFile' : $resultState" 
    } catch {
        if (!$Continue) {
            throw "Error deploying '$jsonFile' ($_)"
        } else {
            return "Error deploying '$jsonFile' ($_)"
        }
    }
}

Export-ModuleMember -Function *
