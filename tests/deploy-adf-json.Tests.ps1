# Set the $version to the 'to be tested' version
$version = '1.1.9'

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
            Mock Get-AzureRmDataFactoryV2 { return $DataFactoryName }
            # Override mock function for Azure 'Get-AzureRmDataFactory' call with -DataFactoryName 'dataFactoryEmpty'
            Mock Get-AzureRmDataFactory { return $null } -ParameterFilter { $DataFactoryName -eq 'dataFactoryEmpty' }

            $resourceGroupName = 'resoureGroupName'

            Context "Existing Azure Data Factory" {
                $dataFactoryName = 'dataFactory'
                $dataFactory = getAzureDataFactory -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName

                It "mock functions correct" {
                    #V1
                    Assert-MockCalled Get-AzureRmDataFactory -Times 1
                    #V2
                    Assert-MockCalled Get-AzureRmDataFactoryV2 -Times 0
                }

                It "return an Azure Data Factory object" {
                    $dataFactory | Should Be $dataFactoryName
                }

                It "complete succesfully" {
                    { $dataFactory } | Should Not Throw
                }
            }

            Context "Existing Azure Data Factory V2" {
                $dataFactoryName = 'dataFactoryV2'
                $version = "V2"
                $dataFactory = getAzureDataFactory -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -Version $version

                It "mock functions correct" {
                    #V1
                    Assert-MockCalled Get-AzureRmDataFactory -Times 0
                    #V2
                    Assert-MockCalled Get-AzureRmDataFactoryV2 -Times 1
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

            It "return value Trigger" {
                $deployType = 3 #trigger
                getFriendlyName $deployType | Should Be "Trigger" 
            }
        }
    }

    Context "function: clearExisting" {
        InModuleScope $linkedModule {
            Mock clearLinkedService { return 3 }
            Mock clearDataset { return 3 }
            Mock clearPipeline { return 3 }
            Mock clearTrigger { return 3 }

            Mock Write-Host {}

            $dataFactory = New-Object Microsoft.Azure.Commands.DataFactories.Models.PSDataFactory
            $dataFactory.ResourceGroupName = 'resourceGroupName'
            $dataFactory.DataFactoryName = 'dataFactory'
            $path = @{ FullName = "C:\temp"; Name = "temp" }

            Context "clear existing Linked Service" {
                $deployType = 0 #linkedservice

                It "correct return value" {
                    $return = clearExisting -DataFactory $dataFactory -DeployType $deployType -Path $path
                    $return | Should Be 3
                }

                It "correct functions called" {
                    Assert-MockCalled clearLinkedService -Times 1
                    Assert-MockCalled clearDataset -Times 0
                    Assert-MockCalled clearPipeline -Times 0
                    Assert-MockCalled clearTrigger -Times 0

                    Assert-MockCalled Write-Host -Times 1
                }
            }

            Context "clear existing Dataset" {
                $deployType = 1 #Dataset

                It "correct return value" {
                    $return = clearExisting -DataFactory $dataFactory -DeployType $deployType -Path $path
                    $return | Should Be 3
                }

                It "correct functions called" {
                    Assert-MockCalled clearLinkedService -Times 0
                    Assert-MockCalled clearDataset -Times 1
                    Assert-MockCalled clearPipeline -Times 0
                    Assert-MockCalled clearTrigger -Times 0

                    Assert-MockCalled Write-Host -Times 1
                }
            }

            Context "clear existing Pipeline" {
                $deployType = 2 #pipeline

                It "correct return value" {
                    $return = clearExisting -DataFactory $dataFactory -DeployType $deployType -Path $path
                    $return | Should Be 3
                }

                It "correct functions called" {
                    Assert-MockCalled clearLinkedService -Times 0
                    Assert-MockCalled clearDataset -Times 0
                    Assert-MockCalled clearPipeline -Times 1
                    Assert-MockCalled clearTrigger -Times 0

                    Assert-MockCalled Write-Host -Times 1
                }
            }

            Context "clear existing Triger" {
                $deployType = 3 #trigger

                It "correct return value" {
                    $return = clearExisting -DataFactory $dataFactory -DeployType $deployType -Path $path
                    $return | Should Be 3
                }

                It "correct functions called" {
                    Assert-MockCalled clearLinkedService -Times 0
                    Assert-MockCalled clearDataset -Times 0
                    Assert-MockCalled clearPipeline -Times 0
                    Assert-MockCalled clearTrigger -Times 1

                    Assert-MockCalled Write-Host -Times 1
                }
            }

            Context "path incorrect parameter" {
                $dataFactory = New-Object Microsoft.Azure.Commands.DataFactories.Models.PSDataFactory
                $dataFactory.ResourceGroupName = 'resourceGroupName'
                $dataFactory.DataFactoryName = 'dataFactory'
                $deployType = 0 #linkedservice
                
                It "check path equal to a empty string" {
                    $path = ""
                    $result = clearExisting -DataFactory $dataFactory -DeployType $deployType -Path $path
                    $result | Should Be -1
                }

                It "check path equal to space" {
                    $path = " "
                    $result = clearExisting -DataFactory $dataFactory -DeployType $deployType -Path $path
                    $result | Should Be -1
                }

                It "check path equal to the working directory" {
                    $path = $env:SYSTEM_DEFAULTWORKINGDIRECTORY
                    $result = clearExisting -DataFactory $dataFactory -DeployType $deployType -Path $path
                    $result | Should Be -1
                }

                It "check path equal to the working directory + '\'" {
                    $path = [String]::Concat($env:SYSTEM_DEFAULTWORKINGDIRECTORY, "\")
                    $result = deploy -DataFactory $dataFactory -DeployType $deployType -Path $path
                    $result | Should Be -1
                }
            }
        }
    }

    Context "function: clearLinkedServices" {
        InModuleScope $linkedModule {
            Mock Get-AzureRmDataFactoryLinkedService { return @( @{ LinkedServiceName = 'linkedservice1' }, @{ LinkedServiceName = 'linkedservice2' }, @{ LinkedServiceName = 'linkedservice3' } ) }
            Mock Get-AzureRmDataFactoryV2LinkedService { return @( @{ LinkedServiceName = 'linkedservice1' }, @{ LinkedServiceName = 'linkedservice2' }, @{ LinkedServiceName = 'linkedservice3' } ) }

            Mock Remove-AzureRmDataFactoryLinkedService { return $true }
            Mock Remove-AzureRmDataFactoryV2LinkedService { return $true }
                
            Context "V1/Default" {    
                $resourceGroupName = 'resourceGroupName'
                $dataFactoryName = 'dataFactory'

                Context "clear existing Linked Service" {
                    It "correct return value" {
                        $return = clearLinkedService -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -Version $version
                        $return | Should Be 3
                    }
    
                    It "correct functions called" {
                        # V1 versions
                        Assert-MockCalled Get-AzureRmDataFactoryLinkedService -Times 1
                        Assert-MockCalled Remove-AzureRmDataFactoryLinkedService -Times 1
                        # V2 versions
                        Assert-MockCalled Get-AzureRmDataFactoryV2LinkedService -Times 0
                        Assert-MockCalled Remove-AzureRmDataFactoryV2LinkedService -Times 0
                    }
                }
            }
            Context "V2" {
                $version = "V2" 
                $resourceGroupName = 'resourceGroupName'
                $dataFactoryName = 'dataFactoryV2'

                Context "clear existing Linked Service" {
                    It "correct return value" {
                        $return = clearLinkedService -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -Version $version
                        $return | Should Be 3
                    }
    
                    It "correct functions called" {
                        # V1 versions
                        Assert-MockCalled Get-AzureRmDataFactoryLinkedService -Times 0
                        Assert-MockCalled Remove-AzureRmDataFactoryLinkedService -Times 0
                        # V2 versions
                        Assert-MockCalled Get-AzureRmDataFactoryV2LinkedService -Times 1
                        Assert-MockCalled Remove-AzureRmDataFactoryV2LinkedService -Times 1
                    }
                }
            }
        }
    }

    Context "function: clearDatasets" {
        InModuleScope $linkedModule {
            Mock Get-AzureRmDataFactoryDataset { return @( @{ DatasetName = 'dataset1' }, @{ DatasetName = 'dataset2' }, @{ DatasetName = 'dataset3' } ) }
            Mock Get-AzureRmDataFactoryV2Dataset { return @( @{ DatasetName = 'dataset1' }, @{ DatasetName = 'dataset2' }, @{ DatasetName = 'dataset3' } ) }
            
            Mock Remove-AzureRmDataFactoryDataset { return $true }
            Mock Remove-AzureRmDataFactoryV2Dataset { return $true }
                
            Context "V1/Default" {    
                $resourceGroupName = 'resourceGroupName'
                $dataFactoryName = 'dataFactory'

                Context "clear existing Dataset" {
                    It "correct return value" {
                        $return = clearDataset -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -Version $version
                        $return | Should Be 3
                    }
    
                    It "correct functions called" {
                        # V1 versions
                        Assert-MockCalled Get-AzureRmDataFactoryDataset -Times 1
                        Assert-MockCalled Remove-AzureRmDataFactoryDataset -Times 1
                        # V2 versions
                        Assert-MockCalled Get-AzureRmDataFactoryV2Dataset -Times 0
                        Assert-MockCalled Remove-AzureRmDataFactoryV2Dataset -Times 0
                    }
                }
            }
            Context "V2" {
                $version = "V2" 
                $resourceGroupName = 'resourceGroupName'
                $dataFactoryName = 'dataFactoryV2'

                Context "clear existing Dataset" {
                    It "correct return value" {
                        $return = clearDataset -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -Version $version
                        $return | Should Be 3
                    }
    
                    It "correct functions called" {
                        # V1 versions
                        Assert-MockCalled Get-AzureRmDataFactoryDataset -Times 0
                        Assert-MockCalled Remove-AzureRmDataFactoryDataset -Times 0
                        # V2 versions
                        Assert-MockCalled Get-AzureRmDataFactoryV2Dataset -Times 1
                        Assert-MockCalled Remove-AzureRmDataFactoryV2Dataset -Times 1
                    }
                }
            }
        }
    }

    Context "function: clearPipelines" {
        InModuleScope $linkedModule {
            Mock Get-AzureRmDataFactoryPipeline { return @( @{ PipelineName = 'pipeline1' }, @{ PipelineName = 'pipeline2' }, @{ PipelineName = 'pipeline3' } ) }
            Mock Get-AzureRmDataFactoryV2Pipeline { return @( @{ PipelineName = 'pipeline1' }, @{ PipelineName = 'pipeline2' }, @{ PipelineName = 'pipeline3' } ) }
            
            Mock Remove-AzureRmDataFactoryPipeline { return $true }
            Mock Remove-AzureRmDataFactoryV2Pipeline { return $true }
                
            Context "V1/Default" {    
                $resourceGroupName = 'resourceGroupName'
                $dataFactoryName = 'dataFactory'

                Context "clear existing Pipeline" {
                    It "correct return value" {
                        $return = clearPipeline -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -Version $version
                        $return | Should Be 3
                    }
    
                    It "correct functions called" {
                        # V1 versions
                        Assert-MockCalled Get-AzureRmDataFactoryPipeline -Times 1
                        Assert-MockCalled Remove-AzureRmDataFactoryPipeline -Times 1
                        # V2 versions
                        Assert-MockCalled Get-AzureRmDataFactoryV2Pipeline -Times 0
                        Assert-MockCalled Remove-AzureRmDataFactoryV2Pipeline -Times 0
                    }
                }
            }
            Context "V2" {
                $version = "V2" 
                $resourceGroupName = 'resourceGroupName'
                $dataFactoryName = 'dataFactoryV2'

                Context "clear existing Pipeline" {
                    It "correct return value" {
                        $return = clearPipeline -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -Version $version
                        $return | Should Be 3
                    }
    
                    It "correct functions called" {
                        # V1 versions
                        Assert-MockCalled Get-AzureRmDataFactoryPipeline -Times 0
                        Assert-MockCalled Remove-AzureRmDataFactoryPipeline -Times 0
                        # V2 versions
                        Assert-MockCalled Get-AzureRmDataFactoryV2Pipeline -Times 1
                        Assert-MockCalled Remove-AzureRmDataFactoryV2Pipeline -Times 1
                    }
                }
            }
        }
    }

    Context "function: clearTriggers" {
        InModuleScope $linkedModule {
            Mock Get-AzureRmDataFactoryV2Trigger { return @( @{ TriggerName = 'trigger1' }, @{ TriggerName = 'trigger2' }, @{ TriggerName = 'trigger3' } ) }

            Mock Remove-AzureRmDataFactoryV2Trigger { return $true }
                
            Context "V2" {
                $version = "V2" 
                $resourceGroupName = 'resourceGroupName'
                $dataFactoryName = 'dataFactoryV2'

                Context "clear existing Trigger" {
                    It "correct return value" {
                        $return = clearTrigger -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -Version $version
                        $return | Should Be 3
                    }
    
                    It "correct functions called" {
                        # V2 versions
                        Assert-MockCalled Get-AzureRmDataFactoryV2Trigger -Times 1
                        Assert-MockCalled Remove-AzureRmDataFactoryV2Trigger -Times 1
                    }
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
            Mock deployTriggerJSON { return @{ ProvisioningState = "Suceeded" } }

            Mock deployLinkedServiceJSON { throw "File not found" } -ParameterFilter { $Json.Name -eq "file2.json" }
            Mock deployDatasetJSON { throw "File not found" } -ParameterFilter { $Json.Name -eq "file2.json" }
            Mock deployPipelineJSON { throw "File not found" } -ParameterFilter { $Json.Name -eq "file2.json" }
            Mock deployTriggerJSON { throw "File not found" } -ParameterFilter { $Json.Name -eq "file2.json" }

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

                It "check Trigger deploy" {
                    $deployType = 3 #trigger
                    $result = deployJson -DataFactory $dataFactory -DeployType $deployType -Json $json -Overwrite $overwrite -Continue $continue
                    $result | Should Be "Deploy Trigger 'file1.json' : Suceeded"
                }

                It "check Trigger deploy - no exception" {
                    $deployType = 3 #pipeline                    
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
                    $result | Should Be "Error deploying 'file2.json' (File not found)"
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
                    $result | Should Be "Error deploying 'file2.json' (File not found)"
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
                    $result | Should Be "Error deploying 'file2.json' (File not found)"
                }

                It "check Pipeline deploy - no exception" {
                    $deployType = 2 #pipeline                    
                    { 
                        $result = deployJson -DataFactory $dataFactory -DeployType $deployType -Json $json -Overwrite $overwrite -Continue $continue
                    } | Should Not Throw
                }

                It "check Trigger deploy" {
                    $deployType = 3 #trigger
                    $result = deployJson -DataFactory $dataFactory -DeployType $deployType -Json $json -Overwrite $overwrite -Continue $continue
                    $result | Should Be "Error deploying 'file2.json' (File not found)"
                }

                It "check Trigger deploy - no exception" {
                    $deployType = 3 #trigger                    
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
            Context "V1/Default" {
                Mock New-AzureRmDataFactoryLinkedService { return "Succeeded" }
                Mock New-AzureRmDataFactoryLinkedService { throw } -ParameterFilter { $DataFactoryName -eq 'dataFactoryOverwrite' }
                Mock New-AzureRmDataFactoryLinkedService { throw } -ParameterFilter { $DataFactoryName -eq 'dataFactoryError' }

                Mock Set-AzureRmDataFactoryV2LinkedService { return "Succeeded" }

                $jsonFile = @{ FullName = "C:\temp\test.json"; Name = "test.json" }
                
                Context "overwrite = `$true" {
                    $resourceGroupName = 'resourceGroupName'
                    $dataFactoryName = 'dataFactory'
                    $overwrite = $true
                
                    $return = deployLinkedServiceJSON -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -JsonFile $jsonFile -Overwrite $overwrite

                    It "mock functions correct" {
                        #V1
                        Assert-MockCalled New-AzureRmDataFactoryLinkedService -Times 1
                        #V2
                        Assert-MockCalled Set-AzureRmDataFactoryV2LinkedService -Times 0
                    }

                    It "check correct deploy" {
                        $return | Should Be "Succeeded"
                    }
                }

                Context "overwrite = `$false" {
                    It "check correct deploy" {
                        $resourceGroupName = 'resourceGroupName'
                        $dataFactoryName = 'dataFactoryOverwrite'

                        $overwrite = $false
                        {
                            deployLinkedServiceJSON -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -JsonFile $jsonFile -Overwrite $overwrite
                        } | Should Throw
                    }

                    It "mock functions correct" {
                        #V1
                        Assert-MockCalled New-AzureRmDataFactoryLinkedService -Times 1 { $DataFactoryName -eq 'dataFactoryOverwrite' }
                        #V2
                        Assert-MockCalled Set-AzureRmDataFactoryV2LinkedService -Times 0
                    }
                }

                Context "Empty DataFactory" {
                    It "check deploy to empty datafactory" {
                        $resourceGroupName = 'resourceGroupName'
                        $dataFactoryName = 'dataFactoryError'

                        $overwrite = $false
                        {
                            deployLinkedServiceJSON -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -JsonFile $jsonFile -Overwrite $overwrite
                        } | Should Throw
                    }

                    It "mock functions correct" {
                        #V1
                        Assert-MockCalled New-AzureRmDataFactoryLinkedService -Times 1 -ParameterFilter { $DataFactoryName -eq 'dataFactoryError' }
                        #V2
                        Assert-MockCalled Set-AzureRmDataFactoryV2LinkedService -Times 0
                    }
                }
            }

            Context "V2" {
                Mock Set-AzureRmDataFactoryV2LinkedService { return "Succeeded" }
                Mock Set-AzureRmDataFactoryV2LinkedService { throw } -ParameterFilter { $DataFactoryName -eq 'dataFactoryV2Overwrite' }
                Mock Set-AzureRmDataFactoryV2LinkedService { throw } -ParameterFilter { $DataFactoryName -eq 'dataFactoryV2Error' }

                Mock New-AzureRmDataFactoryLinkedService { return "Succeeded" }

                $version = "V2"
                $jsonFile = @{ FullName = "C:\temp\test.json"; Name = "test.json" }
                
                Context "overwrite = `$true" {
                    $resourceGroupName = 'resourceGroupName'
                    $dataFactoryName = 'dataFactoryV2'
                    $overwrite = $true
                
                    $return = deployLinkedServiceJSON -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -Version $version -JsonFile $jsonFile -Overwrite $overwrite

                    It "mock functions correct" {
                        #V1
                        Assert-MockCalled New-AzureRmDataFactoryLinkedService -Times 0
                        #V2
                        Assert-MockCalled Set-AzureRmDataFactoryV2LinkedService -Times 1
                    }

                    It "check correct deploy" {
                        $return | Should Be "Succeeded"
                    }
                }

                Context "overwrite = `$false" {
                    It "check correct deploy" {
                        $resourceGroupName = 'resourceGroupName'
                        $dataFactoryName = 'dataFactoryV2Overwrite'

                        $overwrite = $false
                        {
                            deployLinkedServiceJSON -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -Version $version -JsonFile $jsonFile -Overwrite $overwrite
                        } | Should Throw
                    }

                    It "mock functions correct" {
                        #V1
                        Assert-MockCalled New-AzureRmDataFactoryLinkedService -Times 0
                        #V2
                        Assert-MockCalled Set-AzureRmDataFactoryV2LinkedService -Times 1 { $DataFactoryName -eq 'dataFactoryV2Overwrite' }
                    }
                }

                Context "Empty DataFactory" {
                    It "check deploy to empty datafactory" {
                        $resourceGroupName = 'resourceGroupName'
                        $dataFactoryName = 'dataFactoryV2Error'

                        $overwrite = $false
                        {
                            deployLinkedServiceJSON -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -Version $version -JsonFile $jsonFile -Overwrite $overwrite
                        } | Should Throw
                    }

                    It "mock functions correct" {
                        #V1
                        Assert-MockCalled New-AzureRmDataFactoryLinkedService -Times 0
                        #V2
                        Assert-MockCalled Set-AzureRmDataFactoryV2LinkedService -Times 1 -ParameterFilter { $DataFactoryName -eq 'dataFactoryV2Error' }
                    }
                }
            }
        }
    }

    Context "function: deployDatasetJSON" {
        InModuleScope $linkedModule {
            Context "V1/Default" {
                Mock New-AzureRmDataFactoryDataset { return "Succeeded" }
                Mock New-AzureRmDataFactoryDataset { throw } -ParameterFilter { $DataFactoryName -eq 'dataFactoryOverwrite' }
                Mock New-AzureRmDataFactoryDataset { throw } -ParameterFilter { $DataFactoryName -eq 'dataFactoryError' }

                Mock Set-AzureRmDataFactoryV2Dataset { return "Succeeded" }

                $jsonFile = @{ FullName = "C:\temp\test.json"; Name = "test.json" }
                
                Context "overwrite = `$true" {
                    $resourceGroupName = 'resourceGroupName'
                    $dataFactoryName = 'dataFactory'
                    $overwrite = $true
                
                    $return = deployDatasetJSON -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -JsonFile $jsonFile -Overwrite $overwrite

                    It "mock functions correct" {
                        #V1
                        Assert-MockCalled New-AzureRmDataFactoryDataset -Times 1
                        #V2
                        Assert-MockCalled Set-AzureRmDataFactoryV2Dataset -Times 0
                    }

                    It "check correct deploy" {
                        $return | Should Be "Succeeded"
                    }
                }

                Context "overwrite = `$false" {
                    It "check correct deploy" {
                        $resourceGroupName = 'resourceGroupName'
                    $dataFactoryName = 'dataFactoryOverwrite'

                        $overwrite = $false
                        {
                            deployDatasetJSON -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -JsonFile $jsonFile -Overwrite $overwrite
                        } | Should Throw
                    }

                    It "mock functions correct" {
                        #V1
                        Assert-MockCalled New-AzureRmDataFactoryDataset -Times 1 { $DataFactoryName -eq 'dataFactoryOverwrite' }
                        #V2
                        Assert-MockCalled Set-AzureRmDataFactoryV2Dataset -Times 0
                    }
                }

                Context "Empty DataFactory" {
                    It "check deploy to empty datafactory" {
                        $resourceGroupName = 'resourceGroupName'
                        $dataFactoryName = 'dataFactoryError'

                        $overwrite = $false
                        {
                            deployDatasetJSON -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -JsonFile $jsonFile -Overwrite $overwrite
                        } | Should Throw
                    }

                    It "mock functions correct" {
                        #V1
                        Assert-MockCalled New-AzureRmDataFactoryDataset -Times 1 -ParameterFilter { $DataFactoryName -eq 'dataFactoryError' }
                        #V2
                        Assert-MockCalled Set-AzureRmDataFactoryV2Dataset -Times 0
                    }
                }
            }

            Context "V2" {
                Mock Set-AzureRmDataFactoryV2Dataset { return "Succeeded" }
                Mock Set-AzureRmDataFactoryV2Dataset { throw } -ParameterFilter { $DataFactoryName -eq 'dataFactoryV2Overwrite' }
                Mock Set-AzureRmDataFactoryV2Dataset { throw } -ParameterFilter { $DataFactoryName -eq 'dataFactoryV2Error' }

                Mock New-AzureRmDataFactoryDataset { return "Succeeded" }

                $version = "V2"
                $jsonFile = @{ FullName = "C:\temp\test.json"; Name = "test.json" }
                
                Context "overwrite = `$true" {
                    $resourceGroupName = 'resourceGroupName'
                    $dataFactoryName = 'dataFactoryV2'
                    $overwrite = $true
                
                    $return = deployDatasetJSON -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -Version $version -JsonFile $jsonFile -Overwrite $overwrite

                    It "mock functions correct" {
                        #V1
                        Assert-MockCalled New-AzureRmDataFactoryDataset -Times 0
                        #V2
                        Assert-MockCalled Set-AzureRmDataFactoryV2Dataset -Times 1
                    }

                    It "check correct deploy" {
                        $return | Should Be "Succeeded"
                    }
                }

                Context "overwrite = `$false" {
                    It "check correct deploy" {
                        $resourceGroupName = 'resourceGroupName'
                    $dataFactoryName = 'dataFactoryV2Overwrite'

                        $overwrite = $false
                        {
                            deployDatasetJSON -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -Version $version -JsonFile $jsonFile -Overwrite $overwrite
                        } | Should Throw
                    }

                    It "mock functions correct" {
                        #V1
                        Assert-MockCalled New-AzureRmDataFactoryDataset -Times 0
                        #V2
                        Assert-MockCalled Set-AzureRmDataFactoryV2Dataset -Times 1 { $DataFactoryName -eq 'dataFactoryV2Overwrite' }
                    }
                }

                Context "Empty DataFactory" {
                    It "check deploy to empty datafactory" {
                        $resourceGroupName = 'resourceGroupName'
                        $dataFactoryName = 'dataFactoryV2Error'

                        $overwrite = $false
                        {
                            deployDatasetJSON -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -Version $version -JsonFile $jsonFile -Overwrite $overwrite
                        } | Should Throw
                    }

                    It "mock functions correct" {
                        #V1
                        Assert-MockCalled New-AzureRmDataFactoryDataset -Times 0
                        #V2
                        Assert-MockCalled Set-AzureRmDataFactoryV2Dataset -Times 1 -ParameterFilter { $DataFactoryName -eq 'dataFactoryV2Error' }
                    }
                }
            }
        }        
    }

    Context "function: deployPipelineJSON" {
        InModuleScope $linkedModule {
            Context "V1/Default" {
                Mock New-AzureRmDataFactoryPipeline { return "Succeeded" }
                Mock New-AzureRmDataFactoryPipeline { throw } -ParameterFilter { $DataFactoryName -eq 'dataFactoryOverwrite' }
                Mock New-AzureRmDataFactoryPipeline { throw } -ParameterFilter { $DataFactoryName -eq 'dataFactoryError' }

                Mock Set-AzureRmDataFactoryV2Pipeline { return "Succeeded" }

                $jsonFile = @{ FullName = "C:\temp\test.json"; Name = "test.json" }
                
                Context "overwrite = `$true" {
                    $resourceGroupName = 'resourceGroupName'
                    $dataFactoryName = 'dataFactory'
                    $overwrite = $true
                
                    $return = deployPipelineJSON -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -JsonFile $jsonFile -Overwrite $overwrite

                    It "mock functions correct" {
                        #V1
                        Assert-MockCalled New-AzureRmDataFactoryPipeline -Times 1
                        #V2
                        Assert-MockCalled Set-AzureRmDataFactoryV2Pipeline -Times 0
                    }

                    It "check correct deploy" {
                        $return | Should Be "Succeeded"
                    }
                }

                Context "overwrite = `$false" {
                    It "check correct deploy" {
                        $resourceGroupName = 'resourceGroupName'
                        $dataFactoryName = 'dataFactoryOverwrite'

                        $overwrite = $false
                        {
                            deployPipelineJSON -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -JsonFile $jsonFile -Overwrite $overwrite
                        } | Should Throw
                    }

                    It "mock New-AzureRmDataFactoryPipeline correct" {
                        #V1
                        Assert-MockCalled New-AzureRmDataFactoryPipeline -Times 1 { $DataFactoryName -eq 'dataFactoryOverwrite' }
                        #V2
                        Assert-MockCalled Set-AzureRmDataFactoryV2Pipeline -Times 0
                    }
                }

                Context "Empty DataFactory" {
                    It "check deploy to empty datafactory" {
                        $resourceGroupName = 'resourceGroupName'
                        $dataFactoryName = 'dataFactoryError'

                        $overwrite = $false
                        {
                            deployPipelineJSON -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -JsonFile $jsonFile -Overwrite $overwrite
                        } | Should Throw
                    }

                    It "mock funcions correct" {
                        #V1
                        Assert-MockCalled New-AzureRmDataFactoryPipeline -Times 1 -ParameterFilter { $DataFactoryName -eq 'dataFactoryError' }
                        #V2
                        Assert-MockCalled Set-AzureRmDataFactoryV2Pipeline -Times 0
                    }
                }
            }

            Context "V2" {
                Mock Set-AzureRmDataFactoryV2Pipeline { return "Succeeded" }
                Mock Set-AzureRmDataFactoryV2Pipeline { throw } -ParameterFilter { $DataFactoryName -eq 'dataFactoryV2Overwrite' }
                Mock Set-AzureRmDataFactoryV2Pipeline { throw } -ParameterFilter { $DataFactoryName -eq 'dataFactoryV2Error' }

                Mock New-AzureRmDataFactoryPipeline { return "Succeeded" }

                $version = "V2"
                $jsonFile = @{ FullName = "C:\temp\test.json"; Name = "test.json" }
                
                Context "overwrite = `$true" {
                    $resourceGroupName = 'resourceGroupName'
                    $dataFactoryName = 'dataFactoryV2'
                    $overwrite = $true
                
                    $return = deployPipelineJSON -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -Version $version -JsonFile $jsonFile -Overwrite $overwrite

                    It "mock functions correct" {
                        #V1
                        Assert-MockCalled New-AzureRmDataFactoryPipeline -Times 0
                        #V2
                        Assert-MockCalled Set-AzureRmDataFactoryV2Pipeline -Times 1
                    }

                    It "check correct deploy" {
                        $return | Should Be "Succeeded"
                    }
                }

                Context "overwrite = `$false" {
                    It "check correct deploy" {
                        $resourceGroupName = 'resourceGroupName'
                        $dataFactoryName = 'dataFactoryV2Overwrite'

                        $overwrite = $false
                        {
                            deployPipelineJSON -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -Version $version -JsonFile $jsonFile -Overwrite $overwrite
                        } | Should Throw
                    }

                    It "mock functions correct" {
                        #V1
                        Assert-MockCalled New-AzureRmDataFactoryPipeline -Times 0
                        #V2
                        Assert-MockCalled Set-AzureRmDataFactoryV2Pipeline -Times 1 { $DataFactoryName -eq 'dataFactoryV2Overwrite' }
                    }
                }

                Context "Empty DataFactory" {
                    It "check deploy to empty datafactory" {
                        $resourceGroupName = 'resourceGroupName'
                        $dataFactoryName = 'dataFactoryV2Error'

                        $overwrite = $false
                        {
                            deployPipelineJSON -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -Version $version -JsonFile $jsonFile -Overwrite $overwrite
                        } | Should Throw
                    }

                    It "mock functions correct" {
                        #V1
                        Assert-MockCalled New-AzureRmDataFactoryPipeline -Times 0
                        #V2
                        Assert-MockCalled Set-AzureRmDataFactoryV2Pipeline -Times 1 -ParameterFilter { $DataFactoryName -eq 'dataFactoryV2Error' }
                    }
                }
            }
        }
    }

    Context "function: deployTriggerJSON" {
        InModuleScope $linkedModule {
            Context "V2" {
                Mock Set-AzureRmDataFactoryV2Trigger { return "Succeeded" }
                Mock Set-AzureRmDataFactoryV2Trigger { throw } -ParameterFilter { $DataFactoryName -eq 'dataFactoryV2Overwrite' }
                Mock Set-AzureRmDataFactoryV2Trigger { throw } -ParameterFilter { $DataFactoryName -eq 'dataFactoryV2Error' }

                $version = "V2"
                $jsonFile = @{ FullName = "C:\temp\test.json"; Name = "test.json" }
                
                Context "overwrite = `$true" {
                    $resourceGroupName = 'resourceGroupName'
                    $dataFactoryName = 'dataFactoryV2'
                    $overwrite = $true
                
                    $return = deployTriggerJSON -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -Version $version -JsonFile $jsonFile -Overwrite $overwrite

                    It "mock functions correct" {
                        #V2
                        Assert-MockCalled Set-AzureRmDataFactoryV2Trigger -Times 1
                    }

                    It "check correct deploy" {
                        $return | Should Be "Succeeded"
                    }
                }

                Context "overwrite = `$false" {
                    It "check correct deploy" {
                        $resourceGroupName = 'resourceGroupName'
                        $dataFactoryName = 'dataFactoryV2Overwrite'

                        $overwrite = $false
                        {
                            deployTriggerJSON -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -Version $version -JsonFile $jsonFile -Overwrite $overwrite
                        } | Should Throw
                    }

                    It "mock functions correct" {
                        #V2
                        Assert-MockCalled Set-AzureRmDataFactoryV2Trigger -Times 1 { $DataFactoryName -eq 'dataFactoryV2Overwrite' }
                    }
                }

                Context "Empty DataFactory" {
                    It "check deploy to empty datafactory" {
                        $resourceGroupName = 'resourceGroupName'
                        $dataFactoryName = 'dataFactoryV2Error'

                        $overwrite = $false
                        {
                            deployTriggerJSON -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -Version $version -JsonFile $jsonFile -Overwrite $overwrite
                        } | Should Throw
                    }

                    It "mock functions correct" {
                        #V2
                        Assert-MockCalled Set-AzureRmDataFactoryV2Trigger -Times 1 -ParameterFilter { $DataFactoryName -eq 'dataFactoryV2Error' }
                    }
                }
            }
        }
    }

    Context "function: deploy" {
        InModuleScope $linkedModule {
            Mock getFriendlyName { return "Linked Service" }
            Mock Get-ChildItem { @( "linkedservice1.json", "linkedservice2.json", "linkedservice3.json" ) }
            Mock deployJson { return 0 }
            Mock Write-Host {}

            $dataFactory = New-Object Microsoft.Azure.Commands.DataFactories.Models.PSDataFactory
            $dataFactory.ResourceGroupName = 'resourceGroupName'
            $dataFactory.DataFactoryName = 'dataFactory'
            $path = @{ FullName = "C:\temp"; Name = "temp" }
            $deployType = 0 #linkedservice
            $overwrite = $true
            $continue = $true

            Context "correct parameters with overwrite" {
                $result = deploy -DataFactory $dataFactory -DeployType $deployType -Path $path -Overwrite $overwrite -Continue $continue -Clear $clear

                It "correct deployment" {
                    $result | Should Be 0
                }

                It "correct function calls" {
                    Assert-MockCalled getFriendlyName -Times 1
                    Assert-MockCalled Get-ChildItem -Times 1
                    Assert-MockCalled deployJson -Times 3
                    Assert-MockCalled Write-Host -Times 5
                }
            }

            Context "correct parameters with no overwrite" {
                $result = deploy -DataFactory $dataFactory -DeployType $deployType -Path $path -Overwrite $overwrite -Continue $continue -Clear $clear

                It "correct deployment" {
                    $result | Should Be 0
                }

                It "correct function calls" {
                    Assert-MockCalled getFriendlyName -Times 1
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