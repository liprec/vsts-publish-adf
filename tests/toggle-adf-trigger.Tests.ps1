# Set the $version to the 'to be tested' version
$version = '1.0.4'

# Dynamic set the $testModule to the module file linked to the current test file
$linkedModule = (Split-Path -Leaf $MyInvocation.MyCommand.Path).Replace('.Tests.ps1', '')
# Import the logic of the linked module
Import-Module $PSScriptRoot\..\$linkedModule\$version\$linkedModule.psm1 -Force

Describe "Module: $linkedModule" {
    Context "function: setStatus" {
        InModuleScope $linkedModule {
            Mock Start-AzureRmDataFactoryV2Trigger { return }
            Mock Stop-AzureRmDataFactoryV2Trigger { return }

            Mock Start-AzureRmDataFactoryV2Trigger { throw } -ParameterFilter { $DataFactoryName -eq 'dataFactoryError' }
            Mock Stop-AzureRmDataFactoryV2Trigger { throw } -ParameterFilter { $DataFactoryName -eq 'dataFactoryError' }

            Context "Check stop logic" {
                $resourceGroupName = 'resourceGroup'
                $dataFactoryName = 'datafactoryName'
                $triggerName = 'trigger1'
                $triggerStatus = 'stop'

                $status = setStatus -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -TriggerName $triggerName -TriggerStatus $triggerStatus

                It "correct switch path with stop" {
                    Assert-MockCalled Stop-AzureRmDataFactoryV2Trigger -Times 1
                    Assert-MockCalled Start-AzureRmDataFactoryV2Trigger -Times 0
                }
                
                It "correct return" {
                    $status | Should Be "Set 'trigger1' to 'stop'"
                }
            }

            Context "Check start logic" {
                $resourceGroupName = 'resourceGroup'
                $dataFactoryName = 'datafactoryName'
                $triggerName = 'trigger1'
                $triggerStatus = 'start'

                $status = setStatus -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -TriggerName $triggerName -TriggerStatus $triggerStatus

                It "correct switch path with start" {
                    Assert-MockCalled Stop-AzureRmDataFactoryV2Trigger -Times 0
                    Assert-MockCalled Start-AzureRmDataFactoryV2Trigger -Times 1
                }
                
                It "correct return" {
                    $status | Should Be "Set 'trigger1' to 'start'"
                }
            }

            Context "Check stop logic - exception" {
                $resourceGroupName = 'resourceGroup'
                $dataFactoryName = 'dataFactoryError'
                $triggerName = 'trigger1'
                $triggerStatus = 'stop'

                $status = setStatus -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -TriggerName $triggerName -TriggerStatus $triggerStatus

                It "correct switch path with stop" {
                    Assert-MockCalled Stop-AzureRmDataFactoryV2Trigger -Times 1
                    Assert-MockCalled Start-AzureRmDataFactoryV2Trigger -Times 0
                }
                
                It "error return" {
                    $status | Should Be "Error while stopping the trigger 'trigger1' (ScriptHalted)"
                }
            }

            Context "Check start logic - exception" {
                $resourceGroupName = 'resourceGroup'
                $dataFactoryName = 'dataFactoryError'
                $triggerName = 'trigger1'
                $triggerStatus = 'start'

                $status = setStatus -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -TriggerName $triggerName -TriggerStatus $triggerStatus

                It "correct switch path with start" {
                    Assert-MockCalled Stop-AzureRmDataFactoryV2Trigger -Times 0
                    Assert-MockCalled Start-AzureRmDataFactoryV2Trigger -Times 1
                }
                
                It "error return" {
                    $status | Should Be "Error while starting the trigger 'trigger1' (ScriptHalted)"
                }
            }
        }
    }

    Context "function: setTriggerStatus" {
        InModuleScope $linkedModule {
            Mock Get-AzureRmDataFactoryV2Trigger { return }
            Mock Start-AzureRmDataFactoryV2Trigger { return }
            Mock Stop-AzureRmDataFactoryV2Trigger { return }

            Mock Write-Host { return }

            Mock setStatus { throw } -ParameterFilter { $DataFactoryName -eq 'dataFactoryError' }

            Context "One trigger" {
                Context "Correct 'stopping' flow with one trigger and Continue $true" {
                    $resourceGroupName = 'resourceGroup'
                    $dataFactoryName = 'datafactoryName'
                    $triggerName = 'trigger1'
                    $triggerStatus = 'stop'
                    $continue = $true

                    $return = setTriggerStatus -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -TriggerName $triggerName -TriggerStatus $triggerStatus -Continue $continue

                    It "Correct return: " {
                        $return | Should Be 1
                    }

                    It "No Trigger lookup" {
                        Assert-MockCalled Get-AzureRmDataFactoryV2Trigger -Times 0
                    }
                }

                Context "Incorrect 'stopping' flow with one trigger and Continue $true" {
                    $resourceGroupName = 'resourceGroup'
                    $dataFactoryName = 'dataFactoryError'
                    $triggerName = 'trigger1'
                    $triggerStatus = 'stop'
                    $continue = $true

                    $return = setTriggerStatus -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -TriggerName $triggerName -TriggerStatus $triggerStatus -Continue $continue

                    It "Correct error return: " {
                        $return | Should Be "Error 'stop' 'trigger1' (ScriptHalted)"
                    }

                    It "No Trigger lookup" {
                        Assert-MockCalled Get-AzureRmDataFactoryV2Trigger -Times 0
                    }
                }

                Context "Incorrect 'stopping' flow with one trigger and Continue $false" {
                    $resourceGroupName = 'resourceGroup'
                    $dataFactoryName = 'dataFactoryError'
                    $triggerName = 'trigger1'
                    $triggerStatus = 'stop'
                    $continue = $false

                    It "Should throw error: " {
                        {
                            setTriggerStatus -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -TriggerName $triggerName -TriggerStatus $triggerStatus -Continue $continue
                        } | Should Throw
                    }

                    It "No Trigger lookup" {
                        Assert-MockCalled Get-AzureRmDataFactoryV2Trigger -Times 0
                    }
                }

                Context "Correct 'starting' flow with one trigger and Continue $true" {
                    $resourceGroupName = 'resourceGroup'
                    $dataFactoryName = 'datafactoryName'
                    $triggerName = 'trigger1'
                    $triggerStatus = 'start'
                    $continue = $true

                    $return = setTriggerStatus -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -TriggerName $triggerName -TriggerStatus $triggerStatus -Continue $continue

                    It "Correct return: " {
                        $return | Should Be 1
                    }

                    It "No Trigger lookup" {
                        Assert-MockCalled Get-AzureRmDataFactoryV2Trigger -Times 0
                    }
                }

                Context "Incorrect 'starting' flow with one trigger and Continue $true" {
                    $resourceGroupName = 'resourceGroup'
                    $dataFactoryName = 'dataFactoryError'
                    $triggerName = 'trigger1'
                    $triggerStatus = 'start'
                    $continue = $true

                    $return = setTriggerStatus -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -TriggerName $triggerName -TriggerStatus $triggerStatus -Continue $continue

                    It "Correct error return: " {
                        $return | Should Be "Error 'start' 'trigger1' (ScriptHalted)"
                    }

                    It "No Trigger lookup" {
                        Assert-MockCalled Get-AzureRmDataFactoryV2Trigger -Times 0
                    }
                }

                Context "Incorrect 'starting' flow with one trigger and Continue $false" {
                    $resourceGroupName = 'resourceGroup'
                    $dataFactoryName = 'dataFactoryError'
                    $triggerName = 'trigger1'
                    $triggerStatus = 'start'
                    $continue = $false

                    It "Should throw error: " {
                        {
                            setTriggerStatus -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -TriggerName $triggerName -TriggerStatus $triggerStatus -Continue $continue
                        } | Should Throw
                    }

                    It "No Trigger lookup" {
                        Assert-MockCalled Get-AzureRmDataFactoryV2Trigger -Times 0
                    }
                }
            }

            Context "Multiple triggers" {
                Mock Get-AzureRmDataFactoryV2Trigger { return @( @{ Name = 'trigger1' }, @{ Name = 'trigger2' }, @{ Name = 'trigger3' } ) }

                Context "Correct 'stopping' flow with multiple trigger and Continue $true" {
                    $resourceGroupName = 'resourceGroup'
                    $dataFactoryName = 'datafactoryName'
                    $triggerStatus = 'stop'
                    $continue = $true

                    $return = setTriggerStatus -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -TriggerStatus $triggerStatus -Continue $continue

                    It "Correct return: " {
                        $return | Should Be 3
                    }

                    It "Trigger lookup" {
                        Assert-MockCalled Get-AzureRmDataFactoryV2Trigger -Times 1
                    }
                }

                Context "Incorrect 'stopping' flow with multiple trigger and Continue $true" {
                    $resourceGroupName = 'resourceGroup'
                    $dataFactoryName = 'dataFactoryError'
                    $triggerStatus = 'stop'
                    $continue = $true

                    $return = setTriggerStatus -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -TriggerStatus $triggerStatus -Continue $continue

                    It "Correct error return: " {
                        $return | Should Be "Error 'stop' 'trigger1' (ScriptHalted)"
                    }

                    It "Trigger lookup" {
                        Assert-MockCalled Get-AzureRmDataFactoryV2Trigger -Times 1
                    }
                }

                Context "Incorrect 'stopping' flow with multiple trigger and Continue $false" {
                    $resourceGroupName = 'resourceGroup'
                    $dataFactoryName = 'dataFactoryError'
                    $triggerStatus = 'stop'
                    $continue = $false

                    It "Should throw error: " {
                        {
                            setTriggerStatus -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -TriggerStatus $triggerStatus -Continue $continue
                        } | Should Throw
                    }

                    It "Trigger lookup" {
                        Assert-MockCalled Get-AzureRmDataFactoryV2Trigger -Times 1
                    }
                }

                Context "Correct 'starting' flow with multiple trigger and Continue $true" {
                    $resourceGroupName = 'resourceGroup'
                    $dataFactoryName = 'datafactoryName'
                    $triggerStatus = 'start'
                    $continue = $true

                    $return = setTriggerStatus -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -TriggerStatus $triggerStatus -Continue $continue

                    It "Correct return: " {
                        $return | Should Be 3
                    }

                    It "Trigger lookup" {
                        Assert-MockCalled Get-AzureRmDataFactoryV2Trigger -Times 1
                    }
                }

                Context "Incorrect 'starting' flow with multiple trigger and Continue $true" {
                    $resourceGroupName = 'resourceGroup'
                    $dataFactoryName = 'dataFactoryError'
                    $triggerStatus = 'start'
                    $continue = $true

                    $return = setTriggerStatus -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -TriggerStatus $triggerStatus -Continue $continue

                    It "Correct error return: " {
                        $return | Should Be "Error 'start' 'trigger1' (ScriptHalted)"
                    }

                    It "Trigger lookup" {
                        Assert-MockCalled Get-AzureRmDataFactoryV2Trigger -Times 1
                    }
                }

                Context "Incorrect 'starting' flow with multiple trigger and Continue $false" {
                    $resourceGroupName = 'resourceGroup'
                    $dataFactoryName = 'dataFactoryError'
                    $triggerStatus = 'start'
                    $continue = $false

                    It "Should throw error: " {
                        {
                            setTriggerStatus -ResourceGroupName $resourceGroupName -DataFactoryName $dataFactoryName -TriggerStatus $triggerStatus -Continue $continue
                        } | Should Throw
                    }

                    It "Trigger lookup" {
                        Assert-MockCalled Get-AzureRmDataFactoryV2Trigger -Times 1
                    }
                }
            }
        }
    }
}



