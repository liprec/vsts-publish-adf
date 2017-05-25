# Set the $version to the 'to be tested' version
$version = '0.1.0'

# Dynamic set the $testModule to the module file linked to the current test file
$linkedModule = (Split-Path -Leaf $MyInvocation.MyCommand.Path).Replace('.Tests.ps1', '')
# Import the logic of the linked module
Import-Module $PSScriptRoot\..\$linkedModule\$version\$linkedModule.psm1 -Force

Describe "Module: $linkedModule" {
    Context "checkParallel" {
        It "check if it works for a integer value" {
            $p = 5
            $i = checkParallel($p)
            $i | Should Be 5
        }
        It "check if it works for a number as string value" {
            $p = '5'
            $i = checkParallel($p)
            $i | Should Be 5
        }
        It "check if it works for a non-number as string value" {
            $p = 'x5'
            $i = checkParallel($p)
            $i | Should Be 1
        }
        It "check if it works for a empty value" {
            $i = checkParallel($p)
            $i | Should Be 1
        }
    }

    Context "getAzureDataFactory" {
        InModuleScope $linkedModule {
            # Standard mock function for Azure 'Get-AzureRmDataFactory' call
            Mock Get-AzureRmDataFactory { return $DataFactoryName }
            # Override mock function for Azure 'Get-AzureRmDataFactory' call with -DataFactoryName 'dataFactoryEmpty'
            Mock Get-AzureRmDataFactory { return $null } -ParameterFilter { $DataFactoryName -eq 'dataFactoryEmpty' }

            $resourceGroupName = 'resoureGroupName'

            Context "Existing Azure Data Factory" {
                $dataFactoryName = 'dataFactory'
                $dataFactory = getAzureDataFactory -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName

                It "mock Get-AzureRmDataFactory correct" {
                    Assert-MockCalled Get-AzureRmDataFactory -Times 1
                }

                It "return an Azure Data Factory object" {
                    $dataFactory | Should Be $dataFactoryName
                }

                It "complete succesfully" {
                    { $dataFactory } | Should Not Throw
                }
            }

            Context "Non-existing Azure Data Factory" {
                It "throw error if ADF not found" {
                    {
                        $dataFactoryName = 'dataFactoryEmpty' # Mock function returns empty DataFactory
                        getAzureDataFactory -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName
                    } | `
                    Should Throw "Azure Data Factory 'dataFactoryEmpty' could not be found in Resourse Group 'resoureGroupName'"
                }
            }
        }
    }

    Context "convertToDateTime" {
        InModuleScope $linkedModule {
            # Get-Date returns always 2017/03/05T13:24:04Z+03:00 = UTC+3
            $fixedDate = (Get-Date -Year 2017 -Month 3 -Day 5 -Hour 13 -Minute 24 -Second 4).ToUniversalTime().AddHours(3)
            Mock Get-Date { return  $fixedDate } 
            #Mock Get-Date { return "2017/05/01 10:24:04" }

            It "convert options 'Local', Today', 'Midnight'" {
                $timeZone = 'local'
                $dateFixed = 'today'
                $dateCustom = $null
                $timeFixed = 'midnight'
                $timeCustom = $null
                
                $startDateTime = convertToDateTime  -TimeZone $timeZone `
                                    -DateFixed $dateFixed -DateCustom $dateCustom `
                                    -TimeFixed $timeFixed -TimeCustom $timeCustom
                $startDateTime.ToString("yyy/MM/dd hh:mm:ss tt") | Should Be "2017/03/05 12:00:00 AM"
            }

            It "convert options 'Local', Today', 'Noon'" {
                $timeZone = 'local'
                $dateFixed = 'today'
                $dateCustom = $null
                $timeFixed = 'noon'
                $timeCustom = $null
                
                $startDateTime = convertToDateTime  -TimeZone $timeZone `
                                    -DateFixed $dateFixed -DateCustom $dateCustom `
                                    -TimeFixed $timeFixed -TimeCustom $timeCustom
                $startDateTime.ToString("yyy/MM/dd hh:mm:ss tt") | Should Be "2017/03/05 12:00:00 PM"
            }
        }
    }
}


