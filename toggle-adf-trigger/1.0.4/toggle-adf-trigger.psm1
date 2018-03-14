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
function setStatus([string]$ResourceGroupName, [string]$DataFactoryName, [string]$TriggerName, [string]$TriggerStatus){
    switch -CaseSensitive ($TriggerStatus) {
        "start" { 
            try {
                $result = Start-AzureRmDataFactoryV2Trigger -ResourceGroupName $ResourceGroupName -DataFactoryName $DataFactoryName -Name $TriggerName -Force
            } catch {
                return "Error while starting the trigger '$TriggerName' ($_)"
            }
        }
        "stop" {
            try {
                $result = Stop-AzureRmDataFactoryV2Trigger -ResourceGroupName $ResourceGroupName -DataFactoryName $DataFactoryName -Name $TriggerName -Force
            } catch {
                return "Error while stopping the trigger '$TriggerName' ($_)"
            }
        }
    }
    return "Set '$TriggerName' to '$TriggerStatus'"
}

function setTriggerStatus([string]$ResourceGroupName, [string]$DataFactoryName, [string]$TriggerName, [string]$TriggerStatus, $Continue) {
    try {
        if ([string]::IsNullOrWhitespace($TriggerName) -eq $true) {
            $triggers = Get-AzureRmDataFactoryV2Trigger -ResourceGroupName $ResourceGroupName -DataFactoryName $DataFactoryName
        } else {
            $triggers = @{ Name = $TriggerName }
        }
        foreach ($trigger in $triggers) {
            $name = $trigger.Name
            $result = setStatus -ResourceGroupName $ResourceGroupName -DataFactoryName $DataFactoryName -TriggerName $name -TriggerStatus $TriggerStatus
            Write-Host $result
        }
        return $triggers.Count
    }
    catch {
        if (!$Continue) {
            throw "Error '$TriggerStatus' '$name' ($_)"
        } else {
            return "Error '$TriggerStatus' '$name' ($_)"
        }
    }
}

Export-ModuleMember -Function *