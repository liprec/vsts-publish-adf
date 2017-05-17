# Azure Data Factory

This extension adds release tasks related to Azure Data Factory to Visual Studio Team Service.

## Azure Data Factory Deployment

Visual Studio Team Service deploy task that will deploy JSON files with definition of Linked Services, Datasets and/or Pipelines to an existing Azure Data Factory. 
![](images/screenshot-2.png)

### Parameters

Azure Details:
- **Azure Connection Type** - Only Azure Resource Manager is supported
- **Azure RM Subscription** - Which Azure Subscription (Service Endpoint) should be used to connect to the datafactory
- **Resource Group** - To which Resource Group is the Azure Data Factory deployed
- **Azure Data Factory** - The name of the Azure Data Factory

Data Factory Details:
- **Path to Linked Services** [Optional] - Path to the folder in the linked artifact in which contains the JSON definitions for the Linked Services
- **Path to Datasets** [Optional] - Path to the folder in the linked artifact in which contains the JSON definitions for the Datasets
- **Path to Pipelines** [Optional] - Path to the folder in the linked artifact in which contains the JSON definitions for the Pipelines

Advanced:
- **Overwrite** - Option to overwrite existing definitions with the new ones.

## Azure Data Factory Pipelines Management

This release task can be added to a release pipeline to either suspend or resume all pipelines of an Azure Data Factory.
![](images/screenshot-3.png)

### Parameters

Azure Details:
- **Azure Connection Type** - Only Azure Resource Manager is supported
- **Azure RM Subscription** - Which Azure Subscription (Service Endpoint) should be used to connect to the datafactory
- **Resource Group** - To which Resource Group is the Azure Data Factory deployed
- **Azure Data Factory** - The name of the Azure Data Factory

Data Factory Details:
- **Set Pipeline Status** - Option to set the status all the available pipelines to either 'Suspend' or 'Resume'.

## Release notes

**1.0.0**
- Initial release