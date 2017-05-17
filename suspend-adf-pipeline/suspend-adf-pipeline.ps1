Write-Verbose 'Entering script deploy-json.ps1'

Import-Module $PSScriptRoot\ps_modules\VstsAzureHelpers_
Initialize-Azure

$resourceGroupName = Get-VstsInput -Name resourceGroupName -Require
$adfname = Get-VstsInput -Name adfname -Require
$pipelineStatus = Get-VstsInput -Name pipelineStatus -Require

$adf = Get-AzureRmDataFactory -ResourceGroupName $resourceGroupName -Name $adfname

if (!$adf) {
    Write-Host "##vso[task.logissue type=error;] Azure Data Factory '$adfname' could not be found in Resourse Group '$resourceGroupName'"
    throw "Azure Data Factory '$adfname' could not be found in Resourse Group '$resourceGroupName'"
} 

$pipelines = Get-AzureRmDataFactoryPipeline -ResourceGroupName $resourceGroupName -DataFactoryName $adfname

$step = [Math]::Floor(100.0 / $pipelines.Count)
$prg = 0

foreach($pipeline in $pipelines) {

    # Some progress information
    Write-Host "##vso[task.setprogress value=$prg;] ..."
    $prg+=$step

    switch ($pipelineStatus) {
        "suspend" { 
            try {
                Suspend-​Azure​Rm​Data​Factory​Pipeline -ResourceGroupName $resourceGroupName -DataFactoryName $adfname -Name $pipeline -Force 
            } catch {}
        }
        "resume" {
            try {
                Resume-​Azure​Rm​Data​Factory​Pipeline -ResourceGroupName $resourceGroupName -DataFactoryName $adfname -Name $pipeline -Force 
            } catch {}
        }
    }
}

Write-Host "##vso[task.setprogress value=100;] Set pipelines to '$pipelineStatus' complete"