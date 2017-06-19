# Azure Data Factory Deployment

Visual Studio Team Service deploy task that will deploy JSON files with definition of Linked Services, Datasets and/or Pipelines to an existing Azure Data Factory. 
![](../images/screenshot-2.png)

## Parameters

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
- **Continue on Error** - Option to continue deploying after errors occur.
- **Clear before Deploy** - Option to clear the existing difitions before new ones are deployed. Only if a path to Linked Service/Datasets/Pipelines are provided the existing will be cleared.
- **Parallel tasks** - [Future use]Option to set the number of parallel processes.

## Release notes

**1.0.2**
- Add extra error logging

**1.0.0**
- Initial public release