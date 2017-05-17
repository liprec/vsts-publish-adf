Write-Verbose 'Entering script deploy-json.ps1'

Import-Module $PSScriptRoot\ps_modules\VstsAzureHelpers_
Initialize-Azure

$subscriptionId = (Get-AzureRmContext).Subscription.Id

$resourceGroupName = Get-VstsInput -Name resourceGroupName -Require
$adfname = Get-VstsInput -Name adfname -Require
$linkedServiceName = Get-VstsInput -Name linkedServiceName -Require

$sqlAzureServer = Get-VstsInput -Name sqlAzureServer -Require
$sqlAzureDB = Get-VstsInput -Name sqlAzureDB -Require
$sqlAzureUserName = Get-VstsInput -Name sqlAzureUserName -Require
$sqlAzurePassword = Get-VstsInput -Name sqlAzurePassword -Require

$overwrite = Get-VstsInput -Name overwrite -Require

# This is a hack since the agent passes this as a string.
if($overwrite -eq "true"){
    $overwrite = $true
}else{
    $overwrite = $false
}

$adf = Get-AzureRmDataFactory -ResourceGroupName $resourceGroupName -Name $adfname

if (!$adf) {
    Write-Host "##vso[task.logissue type=error;] Azure Data Factory '$adfname' could not be found in Resourse Group '$resourceGroupName'"
    throw "Azure Data Factory '$adfname' could not be found in Resourse Group '$resourceGroupName'"
} 

# Define Linked Service JSON (Azure SQL Database)
$linkedServiceSqlAzure = @" 
{
    "name": "<#linkedServiceName#>",
    "properties": {
        "type": "AzureSqlDatabase",
        "description": "",
        "typeProperties": {
            "connectionString": "Data Source=tcp:<#sqlAzureServer#>,1433;Initial Catalog=<#sqlAzureDB#>;User ID=<#sqlAzureUserName#>;Password=<#sqlAzurePassword#>;Integrated Security=False;Encrypt=True;Connect Timeout=30"
        }
    }
}
"@

$linkedServiceURL = "https://management.azure.com/subscriptions/<#subscriptionId#>/resourcegroups/<#resourceGroupName#>/providers/Microsoft.DataFactory/datafactories/<#dataFactoryName#>/linkedservices/<#linkedServiceName#>?api-version=2015-10-01"

$linkedServiceURL = $linkedServiceURL.Replace("<#subscriptionId#>", $subscriptionId)
$linkedServiceURL = $linkedServiceURL.Replace("<#resourceGroupName#>", $resourceGroupName)
$linkedServiceURL = $linkedServiceURL.Replace("<#dataFactoryName#>", $adfname)
$linkedServiceURL = $linkedServiceURL.Replace("<#linkedServiceName#>", $linkedServiceName)

Invoke-WebRequest -Method Put -Uri $linkedServiceURL -Body $linkedServiceSqlAzure