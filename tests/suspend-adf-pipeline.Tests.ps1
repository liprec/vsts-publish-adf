# Set the $version to the 'to be tested' version
$version = '0.1.12'

# Dynamic set the $testModule to the module file linked to the current test file
$linkedModule = (Split-Path -Leaf $MyInvocation.MyCommand.Path).Replace('.Tests.ps1', '')

# Import the logic of the linked module
Import-Module $PSScriptRoot\..\suspend-adf-pipeline\$version\$linkedModule.psm1 -Force

Describe "Module: suspend-adf-pipeline" {
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

    Context "setPipelineStatus" {
        InModuleScope $linkedModule {
            # Standard mock function for Azure 'Get-AzureRmDataFactoryPipeline' call
            Mock Get-AzureRmDataFactoryPipeline { return @( 'pipeline1', 'pipeline2', 'pipeline3' ) }
            # Override mock function for Azure 'Get-AzureRmDataFactory' call with -DataFactory $null
            Mock Get-AzureRmDataFactoryPipeline { return $null } -ParameterFilter { $DataFactory.DataFactoryName -eq 'dataFactoryEmpty' }
            # Standard mock function for Azure 'Suspend-​Azure​Rm​Data​Factory​Pipeline' call
            Mock Suspend-AzureRmDataFactoryPipeline { return }
            # Standard mock function for Azure 'Resume-​Azure​Rm​Data​Factory​Pipelin' call
            Mock Resume-AzureRmDataFactoryPipeline { return }
            # Overwrite Write-Host to suppress progress information
            Mock Write-Host {}

            $dataFactory = New-Object Microsoft.Azure.Commands.DataFactories.Models.PSDataFactory
            $dataFactory.ResourceGroupName = 'resourceGroupName'
            $dataFactory.DataFactoryName = 'dataFactory'
            $p = 5

            Context "Check suspend logic" {
                $pipelineStatus = 'suspend'
                $pipelineCount = setPipelineStatus -DataFactory $dataFactory -PipelineStatus $pipelineStatus -Parallel $p

                It "mock Get-AzureRmDataFactoryPipeline correct" {
                    Assert-MockCalled Get-AzureRmDataFactoryPipeline -Times 1
                }

                It "mock Suspend-AzureRmDataFactoryPipeline correct -> called 3 times" {
                    Assert-MockCalled Suspend-AzureRmDataFactoryPipeline -Times 3
                }

                It "correct switch path with suspend" {
                    Assert-MockCalled Suspend-AzureRmDataFactoryPipeline -Times 3
                    Assert-MockCalled Resume-AzureRmDataFactoryPipeline -Times 0
                }
                
                It "suspend 3 pipelines" {
                    $pipelineCount | Should Be 3
                }
            }

            Context "Check resume logic" {
                $pipelineStatus = 'resume'
                $pipelineCount = setPipelineStatus -DataFactory $dataFactory -PipelineStatus $pipelineStatus -Parallel $p

                It "mock Get-AzureRmDataFactoryPipeline correct" {
                    Assert-MockCalled Get-AzureRmDataFactoryPipeline -Times 1
                }

                It "mock Resume-AzureRmDataFactoryPipeline correct -> called 3 times" {
                    Assert-MockCalled Resume-AzureRmDataFactoryPipeline -Times 3
                }

                It "correct switch path with resume" {
                    Assert-MockCalled Suspend-AzureRmDataFactoryPipeline -Times 0
                    Assert-MockCalled Resume-AzureRmDataFactoryPipeline -Times 3
                }

                It "resume 3 pipelines" {
                    $pipelineCount | Should Be 3
                }
            }

            Context "Check empty datafactory" {
                $dataFactory = New-Object Microsoft.Azure.Commands.DataFactories.Models.PSDataFactory
                $dataFactory.ResourceGroupName = 'resourceGroupName'
                $dataFactory.DataFactoryName = 'dataFactoryEmpty'
                $pipelineCount = setPipelineStatus -DataFactory $dataFactory -PipelineStatus $pipelineStatus -Parallel $p

                It "no resume/suspend calls" {
                    Assert-MockCalled Suspend-AzureRmDataFactoryPipeline -Times 0
                    Assert-MockCalled Resume-AzureRmDataFactoryPipeline -Times 0
                }

                It "resume non pipelines" {
                    $pipelineCount | Should Be 0
                }
            }
        }
    }
}


