# Set the $version to the 'to be tested' version
$version = '0.3.0'

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

    Context "function: getFriendlyName" {
        InModuleScope $linkedModule {
            It "return value Linked Service" {
                $deployType = 0 #linkedservice
                getFriendlyName $deployType | Should Be "Linked Service" 
            }

            It "return value Dataset" {
                $deployType = 1 #dataset
                getFriendlyName $deployType | Should Be "Dataset" 
            }

            It "return value Pipeline" {
                $deployType = 2 #pipeline
                getFriendlyName $deployType | Should Be "Pipeline" 
            }
        }
    }

    Context "function clearExisting" {
        InModuleScope $linkedModule {
            Mock Get-AzureRmDataFactoryLinkedService { return @( @{ LinkedServiceName = 'linkedservice1' }, @{ LinkedServiceName = 'linkedservice2' }, @{ LinkedServiceName = 'linkedservice3' } ) }
            Mock Get-AzureRmDataFactoryDataset { return @( @{ DatasetName = 'dataset1' }, @{ DatasetName = 'dataset2' }, @{ DatasetName = 'dataset3' } ) }
            Mock Get-AzureRmDataFactoryPipeline { return @( @{ PipelineName = 'pipeline1' }, @{ PipelineName = 'pipeline2' }, @{ PipelineName = 'pipeline3' } ) }

            Mock Remove-AzureRmDataFactoryLinkedService { return $true }
            Mock Remove-AzureRmDataFactoryDataset { return $true }
            Mock Remove-AzureRmDataFactoryPipeline { return $true }

            $dataFactory = New-Object Microsoft.Azure.Commands.DataFactories.Models.PSDataFactory
            $dataFactory.ResourceGroupName = 'resourceGroupName'
            $dataFactory.DataFactoryName = 'dataFactory'

            Context "clear existing Linked Service" {
                $deployType = 0 #linkedservice

                It "correct return value" {
                    $return = clearExisting -DataFactory $dataFactory -DeployType $deployType
                    $return | Should Be 3
                }

                It "correct functions called" {
                    Assert-MockCalled Get-AzureRmDataFactoryLinkedService -Times 1
                    Assert-MockCalled Get-AzureRmDataFactoryDataset -Times 0
                    Assert-MockCalled Get-AzureRmDataFactoryPipeline -Times 0

                    Assert-MockCalled Remove-AzureRmDataFactoryLinkedService -Times 1
                    Assert-MockCalled Remove-AzureRmDataFactoryDataset -Times 0
                    Assert-MockCalled Remove-AzureRmDataFactoryPipeline -Times 0
                }
            }

            Context "clear existing Dataset" {
                $deployType = 1 #Dataset

                It "correct return value" {
                    $return = clearExisting -DataFactory $dataFactory -DeployType $deployType
                    $return | Should Be 3
                }

                It "correct functions called" {
                    Assert-MockCalled Get-AzureRmDataFactoryLinkedService -Times 0
                    Assert-MockCalled Get-AzureRmDataFactoryDataset -Times 1
                    Assert-MockCalled Get-AzureRmDataFactoryPipeline -Times 0

                    Assert-MockCalled Remove-AzureRmDataFactoryLinkedService -Times 0
                    Assert-MockCalled Remove-AzureRmDataFactoryDataset -Times 1
                    Assert-MockCalled Remove-AzureRmDataFactoryPipeline -Times 0
                }
            }

            Context "clear existing Pipeline" {
                $deployType = 2 #pipeline

                It "correct return value" {
                    $return = clearExisting -DataFactory $dataFactory -DeployType $deployType
                    $return | Should Be 3
                }

                It "correct functions called" {
                    Assert-MockCalled Get-AzureRmDataFactoryLinkedService -Times 0
                    Assert-MockCalled Get-AzureRmDataFactoryDataset -Times 0
                    Assert-MockCalled Get-AzureRmDataFactoryPipeline -Times 1

                    Assert-MockCalled Remove-AzureRmDataFactoryLinkedService -Times 0
                    Assert-MockCalled Remove-AzureRmDataFactoryDataset -Times 0
                    Assert-MockCalled Remove-AzureRmDataFactoryPipeline -Times 1
                }
            }
        }
    }

    Context "function: deployJson" {    
        InModuleScope $linkedModule {
            #Mock Write-Host {}
            #
            Mock deployLinkedServiceJSON { return @{ ProvisioningState = "Suceeded" } }
            Mock deployDatasetJSON { return @{ ProvisioningState = "Suceeded" } }
            Mock deployPipelineJSON { return @{ ProvisioningState = "Suceeded" } }

            Mock deployLinkedServiceJSON { throw } -ParameterFilter { $Json.Name -eq "file2.json" }
            Mock deployDatasetJSON { throw } -ParameterFilter { $Json.Name -eq "file2.json" }
            Mock deployPipelineJSON { throw } -ParameterFilter { $Json.Name -eq "file2.json" }

            $dataFactory = New-Object Microsoft.Azure.Commands.DataFactories.Models.PSDataFactory
            $dataFactory.ResourceGroupName = 'resourceGroupName'
            $dataFactory.DataFactoryName = 'dataFactory'

            Context "correct parameters" {
                $overwrite = $true
                $continue = $true
                $Json = @{FullName = "C:\\temp\\file1.json"}
                $Json.Name = "file1.json"

                It "check Linked Service deploy" {
                    $deployType = 0 #linkedservice                    
                    $result = deployJson -DataFactory $dataFactory -DeployType $deployType -Json $json -Overwrite $overwrite -Continue $continue
                    $result | Should Be "Deploy Linked Service 'file1.json' : Suceeded"
                }

                It "check Linked Service deploy - no exception" {
                    $deployType = 0 #linkedservice                    
                    { 
                        $result = deployJson -DataFactory $dataFactory -DeployType $deployType -Json $json -Overwrite $overwrite -Continue $continue
                    } | Should Not Throw
                }

                It "check Dataset deploy" {
                    $deployType = 1 #dataset
                    $result = deployJson -DataFactory $dataFactory -DeployType $deployType -Json $json -Overwrite $overwrite -Continue $continue
                    $result | Should Be "Deploy Dataset 'file1.json' : Suceeded"
                }

                It "check Dataset deploy - no exception" {
                    $deployType = 1 #dataset                    
                    { 
                        $result = deployJson -DataFactory $dataFactory -DeployType $deployType -Json $json -Overwrite $overwrite -Continue $continue
                    } | Should Not Throw
                }

                It "check Pipeline deploy" {
                    $deployType = 2 #pipeline
                    $result = deployJson -DataFactory $dataFactory -DeployType $deployType -Json $json -Overwrite $overwrite -Continue $continue
                    $result | Should Be "Deploy Pipeline 'file1.json' : Suceeded"
                }

                It "check Pipeline deploy - no exception" {
                    $deployType = 2 #pipeline                    
                    { 
                        $result = deployJson -DataFactory $dataFactory -DeployType $deployType -Json $json -Overwrite $overwrite -Continue $continue
                    } | Should Not Throw
                }
            }

            Context "deploy throws error; continue set to `$true" {
                $deployType = 0 #linkedservice
                $overwrite = $true
                $continue = $true
                $Json = @{FullName = "C:\\temp\\file2.json"}
                $Json.Name = "file2.json"

                It "check Linked Service deploy" {
                    $deployType = 0 #linkedservice                    
                    $result = deployJson -DataFactory $dataFactory -DeployType $deployType -Json $json -Overwrite $overwrite -Continue $continue
                    $result | Should Be "Error deploying 'file2.json' : "
                }

                It "check Linked Service deploy - no exception" {
                    $deployType = 0 #linkedservice                    
                    { 
                        $result = deployJson -DataFactory $dataFactory -DeployType $deployType -Json $json -Overwrite $overwrite -Continue $continue
                    } | Should Not Throw
                }

                It "check Dataset deploy" {
                    $deployType = 1 #dataset
                    $result = deployJson -DataFactory $dataFactory -DeployType $deployType -Json $json -Overwrite $overwrite -Continue $continue
                    $result | Should Be "Error deploying 'file2.json' : "
                }

                It "check Dataset deploy - no exception" {
                    $deployType = 1 #dataset                    
                    { 
                        $result = deployJson -DataFactory $dataFactory -DeployType $deployType -Json $json -Overwrite $overwrite -Continue $continue
                    } | Should Not Throw
                }

                It "check Pipeline deploy" {
                    $deployType = 2 #pipeline
                    $result = deployJson -DataFactory $dataFactory -DeployType $deployType -Json $json -Overwrite $overwrite -Continue $continue
                    $result | Should Be "Error deploying 'file2.json' : "
                }

                It "check Pipeline deploy - no exception" {
                    $deployType = 2 #pipeline                    
                    { 
                        $result = deployJson -DataFactory $dataFactory -DeployType $deployType -Json $json -Overwrite $overwrite -Continue $continue
                    } | Should Not Throw
                }
            }

            Context "deploy throws error; continue set to `$false" {
                $deployType = 0 #linkedservice
                $overwrite = $true
                $continue = $false
                $Json = @{FullName = "C:\\temp\\file2.json"}
                $Json.Name = "file2.json"

                It "check Linked Service deploy - exception" {
                    $deployType = 0 #linkedservice                    
                    { 
                        $result = deployJson -DataFactory $dataFactory -DeployType $deployType -Json $json -Overwrite $overwrite -Continue $continue
                    } | Should Throw
                }

                It "check Dataset deploy - exception" {
                    $deployType = 1 #dataset                    
                    { 
                        $result = deployJson -DataFactory $dataFactory -DeployType $deployType -Json $json -Overwrite $overwrite -Continue $continue
                    } | Should Throw
                }

                It "check Pipeline deploy - exception" {
                    $deployType = 1 #pipeline                    
                    { 
                        $result = deployJson -DataFactory $dataFactory -DeployType $deployType -Json $json -Overwrite $overwrite -Continue $continue
                    } | Should Throw
                }
            }
        }
    }

    Context "function: deployLinkedServiceJSON" {
        InModuleScope $linkedModule {
            Mock New-AzureRmDataFactoryLinkedService { return "Succeeded" }
            Mock New-AzureRmDataFactoryLinkedService { throw } -ParameterFilter { $DataFactory.DataFactoryName -eq 'dataFactoryOverwrite' }
            Mock New-AzureRmDataFactoryLinkedService { throw } -ParameterFilter { $DataFactory.DataFactoryName -eq 'dataFactoryError' }

            $jsonFile = "C:\\temp\\test.json"
            
            Context "overwrite = `$true" {
                $dataFactory = New-Object Microsoft.Azure.Commands.DataFactories.Models.PSDataFactory
                $dataFactory.ResourceGroupName = 'resourceGroupName'
                $dataFactory.DataFactoryName = 'dataFactory'
                $overwrite = $true
            
                $return = deployLinkedServiceJSON -DataFactory $dataFactory -JsonFile $jsonFile -Overwrite $overwrite

                It "mock New-AzureRmDataFactoryLinkedService correct" {
                    Assert-MockCalled New-AzureRmDataFactoryLinkedService -Times 1
                }

                It "check correct deploy" {
                    $return | Should Be "Succeeded"
                }
            }

            Context "overwrite = `$false" {
                It "check correct deploy" {
                    $dataFactory = New-Object Microsoft.Azure.Commands.DataFactories.Models.PSDataFactory
                    $dataFactory.ResourceGroupName = 'resourceGroupName'
                    $dataFactory.DataFactoryName = 'dataFactoryOverwrite'

                    $overwrite = $false
                    {
                        deployLinkedServiceJSON -DataFactory $dataFactory -JsonFile $jsonFile -Overwrite $overwrite
                    } | Should Throw
                }

                It "mock New-AzureRmDataFactoryLinkedService correct" {
                    Assert-MockCalled New-AzureRmDataFactoryLinkedService -Times 1 { $DataFactory.DataFactoryName -eq 'dataFactoryOverwrite' }
                }
            }

            Context "Empty DataFactory" {
                It "check deploy to empty datafactory" {
                    $dataFactory = New-Object Microsoft.Azure.Commands.DataFactories.Models.PSDataFactory
                    $dataFactory.ResourceGroupName = 'resourceGroupName'
                    $dataFactory.DataFactoryName = 'dataFactoryError'

                    $overwrite = $false
                    {
                        deployLinkedServiceJSON -DataFactory $dataFactory -JsonFile $jsonFile -Overwrite $overwrite
                    } | Should Throw
                }

                It "mock New-AzureRmDataFactoryLinkedService correct" {
                    Assert-MockCalled New-AzureRmDataFactoryLinkedService -Times 1 -ParameterFilter { $DataFactory.DataFactoryName -eq 'dataFactoryError' }
                }
            }
        }
    }

    Context "function: deployDatasetJSON" {
        InModuleScope $linkedModule {
            Mock New-AzureRmDataFactoryDataset { return "Succeeded" }
            Mock New-AzureRmDataFactoryDataset { throw } -ParameterFilter { $DataFactory.DataFactoryName -eq 'dataFactoryOverwrite' }
            Mock New-AzureRmDataFactoryDataset { throw } -ParameterFilter { $DataFactory.DataFactoryName -eq 'dataFactoryError' }

            $jsonFile = "C:\\temp\\test.json"
            
            Context "overwrite = `$true" {
                $dataFactory = New-Object Microsoft.Azure.Commands.DataFactories.Models.PSDataFactory
                $dataFactory.ResourceGroupName = 'resourceGroupName'
                $dataFactory.DataFactoryName = 'dataFactory'
                $overwrite = $true
            
                $return = deployDatasetJSON -DataFactory $dataFactory -JsonFile $jsonFile -Overwrite $overwrite

                It "mock New-AzureRmDataFactoryDataset correct" {
                    Assert-MockCalled New-AzureRmDataFactoryDataset -Times 1
                }

                It "check correct deploy" {
                    $return | Should Be "Succeeded"
                }
            }

            Context "overwrite = `$false" {
                It "check correct deploy" {
                    $dataFactory = New-Object Microsoft.Azure.Commands.DataFactories.Models.PSDataFactory
                    $dataFactory.ResourceGroupName = 'resourceGroupName'
                    $dataFactory.DataFactoryName = 'dataFactoryOverwrite'

                    $overwrite = $false
                    {
                        deployDatasetJSON -DataFactory $dataFactory -JsonFile $jsonFile -Overwrite $overwrite
                    } | Should Throw
                }

                It "mock New-AzureRmDataFactoryDataset correct" {
                    Assert-MockCalled New-AzureRmDataFactoryDataset -Times 1 { $DataFactory.DataFactoryName -eq 'dataFactoryOverwrite' }
                }
            }

            Context "Empty DataFactory" {
                It "check deploy to empty datafactory" {
                    $dataFactory = New-Object Microsoft.Azure.Commands.DataFactories.Models.PSDataFactory
                    $dataFactory.ResourceGroupName = 'resourceGroupName'
                    $dataFactory.DataFactoryName = 'dataFactoryError'

                    $overwrite = $false
                    {
                        deployDatasetJSON -DataFactory $dataFactory -JsonFile $jsonFile -Overwrite $overwrite
                    } | Should Throw
                }

                It "mock New-AzureRmDataFactoryDataset correct" {
                    Assert-MockCalled New-AzureRmDataFactoryDataset -Times 1 -ParameterFilter { $DataFactory.DataFactoryName -eq 'dataFactoryError' }
                }
            }
        }        
    }

    Context "function: deployPipelineJSON" {
        InModuleScope $linkedModule {
            Mock New-AzureRmDataFactoryPipeline { return "Succeeded" }
            Mock New-AzureRmDataFactoryPipeline { throw } -ParameterFilter { $DataFactory.DataFactoryName -eq 'dataFactoryOverwrite' }
            Mock New-AzureRmDataFactoryPipeline { throw } -ParameterFilter { $DataFactory.DataFactoryName -eq 'dataFactoryError' }

            $jsonFile = "C:\\temp\\test.json"
            
            Context "overwrite = `$true" {
                $dataFactory = New-Object Microsoft.Azure.Commands.DataFactories.Models.PSDataFactory
                $dataFactory.ResourceGroupName = 'resourceGroupName'
                $dataFactory.DataFactoryName = 'dataFactory'
                $overwrite = $true
            
                $return = deployPipelineJSON -DataFactory $dataFactory -JsonFile $jsonFile -Overwrite $overwrite

                It "mock New-AzureRmDataFactoryPipeline correct" {
                    Assert-MockCalled New-AzureRmDataFactoryPipeline -Times 1
                }

                It "check correct deploy" {
                    $return | Should Be "Succeeded"
                }
            }

            Context "overwrite = `$false" {
                It "check correct deploy" {
                    $dataFactory = New-Object Microsoft.Azure.Commands.DataFactories.Models.PSDataFactory
                    $dataFactory.ResourceGroupName = 'resourceGroupName'
                    $dataFactory.DataFactoryName = 'dataFactoryOverwrite'

                    $overwrite = $false
                    {
                        deployPipelineJSON -DataFactory $dataFactory -JsonFile $jsonFile -Overwrite $overwrite
                    } | Should Throw
                }

                It "mock New-AzureRmDataFactoryPipeline correct" {
                    Assert-MockCalled New-AzureRmDataFactoryPipeline -Times 1 { $DataFactory.DataFactoryName -eq 'dataFactoryOverwrite' }
                }
            }

            Context "Empty DataFactory" {
                It "check deploy to empty datafactory" {
                    $dataFactory = New-Object Microsoft.Azure.Commands.DataFactories.Models.PSDataFactory
                    $dataFactory.ResourceGroupName = 'resourceGroupName'
                    $dataFactory.DataFactoryName = 'dataFactoryError'

                    $overwrite = $false
                    {
                        deployPipelineJSON -DataFactory $dataFactory -JsonFile $jsonFile -Overwrite $overwrite
                    } | Should Throw
                }

                It "mock New-AzureRmDataFactoryPipeline correct" {
                    Assert-MockCalled New-AzureRmDataFactoryPipeline -Times 1 -ParameterFilter { $DataFactory.DataFactoryName -eq 'dataFactoryError' }
                }
            }
        }
    }

    Context "function: deploy" {
        InModuleScope $linkedModule {
            Mock getFriendlyName { return "Linked Service" }
            Mock clearExisting {return 0 }
            Mock Get-ChildItem { @( "linkedservice1.json", "linkedservice2.json", "linkedservice3.json" ) }
            Mock deployJson { return 0 }
            Mock Write-Host {}

            $dataFactory = New-Object Microsoft.Azure.Commands.DataFactories.Models.PSDataFactory
            $dataFactory.ResourceGroupName = 'resourceGroupName'
            $dataFactory.DataFactoryName = 'dataFactory'
            $path = "C:\\temp"
            $deployType = 0 #linkedservice
            $overwrite = $true
            $continue = $true

            Context "correct parameters with overwrite" {
                $clear = $true
                $result = deploy -DataFactory $dataFactory -DeployType $deployType -Path $path -Overwrite $overwrite -Continue $continue -Clear $clear

                It "correct deployment" {
                    $result | Should Be 0
                }

                It "correct function calls" {
                    Assert-MockCalled getFriendlyName -Times 1
                    Assert-MockCalled clearExisting -Times 1
                    Assert-MockCalled Get-ChildItem -Times 1
                    Assert-MockCalled deployJson -Times 3
                    Assert-MockCalled Write-Host -Times 6
                }
            }

            Context "correct parameters with no overwrite" {
                $clear = $false
                $result = deploy -DataFactory $dataFactory -DeployType $deployType -Path $path -Overwrite $overwrite -Continue $continue -Clear $clear

                It "correct deployment" {
                    $result | Should Be 0
                }

                It "correct function calls" {
                    Assert-MockCalled getFriendlyName -Times 1
                    Assert-MockCalled clearExisting -Times 0
                    Assert-MockCalled Get-ChildItem -Times 1
                    Assert-MockCalled deployJson -Times 3
                    Assert-MockCalled Write-Host -Times 5
                }
            }


            Context "path incorrect parameter" {
                $dataFactory = New-Object Microsoft.Azure.Commands.DataFactories.Models.PSDataFactory
                $dataFactory.ResourceGroupName = 'resourceGroupName'
                $dataFactory.DataFactoryName = 'dataFactory'
                $deployType = 0 #linkedservice
                $overwrite = $true
                $continue = $true
                $clear = $false

                It "check path equal to a empty string" {
                    $path = ""
                    $result = deploy -DataFactory $dataFactory -DeployType $deployType -Path $path -Overwrite $overwrite -Continue $continue -Clear $clear
                    $result | Should Be -1
                }

                It "check path equal to space" {
                    $path = " "
                    $result = deploy -DataFactory $dataFactory -DeployType $deployType -Path $path -Overwrite $overwrite -Continue $continue -Clear $clear
                    $result | Should Be -1
                }

                It "check path equal to the working directory" {
                    $path = $env:SYSTEM_DEFAULTWORKINGDIRECTORY
                    $result = deploy -DataFactory $dataFactory -DeployType $deployType -Path $path -Overwrite $overwrite -Continue $continue -Clear $clear
                    $result | Should Be -1
                }

                It "check path equal to the working directory + '\'" {
                    $path = [String]::Concat($env:SYSTEM_DEFAULTWORKINGDIRECTORY, "\")
                    $result = deploy -DataFactory $dataFactory -DeployType $deployType -Path $path -Overwrite $overwrite -Continue $continue -Clear $clear
                    $result | Should Be -1
                }
            }
        }
    }
}