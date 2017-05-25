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
Short description

.DESCRIPTION
Long description

.PARAMETER TimeZone
Parameter description

.PARAMETER DateChoose
Parameter description

.PARAMETER DateCustom
Parameter description

.PARAMETER TimeFixed
Parameter description

.PARAMETER TimeCustom
Parameter description

.EXAMPLE
An example
#>
function convertToDateTime($TimeZone, $DateFixed, $DateCustom, $TimeFixed, $TimeCustom) {
    
    switch ($DateFixed) {
        "today" {
            $rDate = (Get-Date)
        }
        "yesterday" {
            $rDate = (Get-Date).AddDays(-1)
        }
        "tomorrow" {
            $rDate = (Get-Date).AddDays(1)
        }
        "custom" {
            try {
                $rDate = Get-Date -Date $DateCustom
            } catch {
                throw "Incorrect custom date provided"
            }
        }
    }
    $rDate = $rDate.Date

    switch ($TimeFixed) {
        "midnight" {
        }
        "noon" {
            $rDate = $rDate.AddHours(12)
        }
        "now" {
            $rDate = $rDate.AddTicks($rDate.TimeOfDay.Ticks)
        }
        "custom" {
            try {
                $rDate = $rDate.AddTicks((New-TimeSpan $TimeCustom).Ticks)
            } catch {
                throw "Incorrect custom time provided"
            }
        }
    }
    return $rDate
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

Export-ModuleMember -Function *