# Set the $version to the 'to be tested' version
$version = '1.0.5'

# Dynamic set the $testModule to the module file linked to the current test file
$linkedModule = (Split-Path -Leaf $MyInvocation.MyCommand.Path).Replace('.Tests.ps1', '')
# Import the logic of the linked module
Import-Module $PSScriptRoot\..\$linkedModule\$version\$linkedModule.psm1 -Force

Describe "Module: $linkedModule" {
    Context "function: checkParallel" {
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

    Context "function: getAzureDataFactory" {
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

    Context "function: setStatus" {
        InModuleScope $linkedModule {
            # Standard mock function for Azure 'Suspend-​Azure​Rm​Data​Factory​Pipeline' call
            Mock Suspend-AzureRmDataFactoryPipeline { return }
            # Standard mock function for Azure 'Resume-​Azure​Rm​Data​Factory​Pipelin' call
            Mock Resume-AzureRmDataFactoryPipeline { return }

            Context "Check empty DataFactory" {
                $dataFactory = $null

                $pipeline = 'pipeline1'
                $pipelineStatus = 'suspend'                

                $status = setStatus -DataFactory $DataFactory -Pipeline $pipeline -PipelineStatus $pipelineStatus

                It "empty DataFactory" {
                    $status | Should Be -1
                }
            }

            Context "Check suspend logic" {
                $dataFactory = New-Object Microsoft.Azure.Commands.DataFactories.Models.PSDataFactory
                $dataFactory.ResourceGroupName = 'resourceGroupName'
                $dataFactory.DataFactoryName = 'dataFactory'    

                $pipeline = @{ PipelineName = 'pipeline1' }
                $pipelineStatus = 'suspend'                

                $status = setStatus -DataFactory $dataFactory -Pipeline $pipeline -PipelineStatus $pipelineStatus

                It "mock Suspend-AzureRmDataFactoryPipeline correct -> called 1 times" {
                    Assert-MockCalled Suspend-AzureRmDataFactoryPipeline -Times 1
                }

                It "correct switch path with suspend" {
                    Assert-MockCalled Suspend-AzureRmDataFactoryPipeline -Times 1
                    Assert-MockCalled Resume-AzureRmDataFactoryPipeline -Times 0
                }
                
                It "correct return" {
                    $status | Should Be "Set 'pipeline1' to 'suspend'"
                }
            }

            Context "Check resume logic" {
                $dataFactory = New-Object Microsoft.Azure.Commands.DataFactories.Models.PSDataFactory
                $dataFactory.ResourceGroupName = 'resourceGroupName'
                $dataFactory.DataFactoryName = 'dataFactory'    

                $pipeline = @{ PipelineName = 'pipeline1' }
                $pipelineStatus = 'resume'                

                $status = setStatus -DataFactory $dataFactory -Pipeline $pipeline -PipelineStatus $pipelineStatus

                It "mock Suspend-AzureRmDataFactoryPipeline correct -> called 1 times" {
                    Assert-MockCalled Resume-AzureRmDataFactoryPipeline -Times 1
                }

                It "correct switch path with suspend" {
                    Assert-MockCalled Suspend-AzureRmDataFactoryPipeline -Times 0
                    Assert-MockCalled Resume-AzureRmDataFactoryPipeline -Times 1
                }
                
                It "correct return" {
                    $status | Should Be "Set 'pipeline1' to 'resume'"
                }
            }
        }
    }

    Context "function: setPipelineStatus" {
        InModuleScope $linkedModule {
            # Standard mock function for Azure 'Get-AzureRmDataFactoryPipeline' call
            Mock Get-AzureRmDataFactoryPipeline { return @( @{ PipelineName = 'pipeline1' }, @{ PipelineName = 'pipeline2' }, @{ PipelineName = 'pipeline3' } ) }
            # Override mock function for Azure 'Get-AzureRmDataFactory' call with -DataFactory $null
            Mock Get-AzureRmDataFactoryPipeline { return $null } -ParameterFilter { $DataFactory.DataFactoryName -eq 'dataFactoryEmpty' }
            #
            Mock Suspend-AzureRmDataFactoryPipeline { return $true }
            #
            Mock Resume-AzureRmDataFactoryPipeline { return }
            # Overwrite Write-Host to suppress progress information
            Mock Write-Host { return }

            $dataFactory = New-Object Microsoft.Azure.Commands.DataFactories.Models.PSDataFactory
            $dataFactory.ResourceGroupName = 'resourceGroupName'
            $dataFactory.DataFactoryName = 'dataFactory'
            $p = 5

            Context "Check parameters for parallel Process" {
                $pipelineStatus = 'suspend'
                $pipelineCount = setPipelineStatus -DataFactory $dataFactory -PipelineStatus $pipelineStatus -Parallel $p

                It "mock Get-AzureRmDataFactoryPipeline correct" {
                    Assert-MockCalled Get-AzureRmDataFactoryPipeline -Times 1
                }
            }

            Context "Number of pipelines" {
                $pipelineStatus = 'suspend'
                $pipelineCount = setPipelineStatus -DataFactory $dataFactory -PipelineStatus $pipelineStatus -Parallel $p

                It "return 3 pipelines" {
                    $pipelineCount | Should Be 3
                }
            }

            Context "Check empty datafactory" {
                $dataFactory = New-Object Microsoft.Azure.Commands.DataFactories.Models.PSDataFactory
                $dataFactory.ResourceGroupName = 'resourceGroupName'
                $dataFactory.DataFactoryName = 'dataFactoryEmpty'
                $pipelineCount = setPipelineStatus -DataFactory $dataFactory -PipelineStatus $pipelineStatus -Parallel $p

                It "resume non pipelines" {
                    $pipelineCount | Should Be 0
                }

                It "mock Get-AzureRmDataFactoryPipeline correct" {
                    Assert-MockCalled Get-AzureRmDataFactoryPipeline -Times 1 -ParameterFilter { $DataFactory.DataFactoryName -eq 'dataFactoryEmpty' }
                }
            }
        }
    }
}



