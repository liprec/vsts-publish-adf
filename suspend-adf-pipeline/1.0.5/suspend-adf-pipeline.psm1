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
Short description

.DESCRIPTION
Long description

.PARAMETER DataFactory
Parameter description

.PARAMETER Pipeline
Parameter description

.PARAMETER PipelineStatus
Parameter description

.EXAMPLE
An example

.NOTES
General notes
#>
function setStatus($DataFactory, $Pipeline, $PipelineStatus){
    if ($DataFactory) {
        $pipelineName = $Pipeline.PipelineName
        switch -CaseSensitive ($PipelineStatus) {
            "suspend" { 
                try {
                    $result = Suspend-AzureRmDataFactoryPipeline -DataFactory $DataFactory -Name $pipelineName 
                } catch {
                    return "Error setting pipeline '$pipelineName' to 'suspend' ($_.exception.message)"
                }
            }
            "resume" {
                try {
                    $result = Resume-AzureRmDataFactoryPipeline -DataFactory $DataFactory -Name $pipelineName
                } catch {
                    return "Error setting pipeline '$pipelineName' to 'resume' ($_.exception.message)"
                }
            }
        }
        return "Set '$pipelineName' to '$PipelineStatus'"
    } else {
        return "-1"
    }
}

<#
.SYNOPSIS
Sets all the Azure Data Factory pipelines to the given status

.DESCRIPTION
Helper function that sets all the Azure Data Factory pipelines to the provided status of either 'Resume' or 'Suspended'

.PARAMETER DataFactory
An Azure Data Factory object

.PARAMETER PipelineStatus
Pipeline status: 'suspend' or 'resume'

.PARAMETER Parallel
Number of parallel tasks

.EXAMPLE
$adf = getAzureDataFactory -ResourceGroupName 'resourceGroup' -DataFactoryName 'datafactory'

setPipelineStatus -DataFactory $adf -PipelineStatus 'suspend' -Parallel 5
#>
function setPipelineStatus($DataFactory, [string]$PipelineStatus, [int]$Parallel) {
    $pipelines = Get-AzureRmDataFactoryPipeline -DataFactory $DataFactory
    $step = [Math]::Floor(100.0 / $pipelines.Count)

    foreach ($pipeline in $pipelines) {
        $result = setStatus -DataFactory $DataFactory -Pipeline $pipeline -PipelineStatus $PipelineStatus
        Write-Host $result
    }

    return $pipelines.Count
}

Export-ModuleMember -Function *