# Azure Data Factory Deployment

Azure DevOps deploy task that will deploy JSON files with definition of Linked Services, Datasets and/or Pipelines to an existing Azure Data Factory. 
![](../images/screenshot-2.png)

## Parameters

Generic:

- **Display name** - Description name of the task
- **Azure Subscription** - Which Azure Subscription (Service Endpoint) should be used to connect to the datafactory

Azure Details:
- **Resource Group** - To which Resource Group is the Azure Data Factory deployed
- **Azure Data Factory** - The name of the Azure Data Factory.

Data Factory Details:

- **Path to Linked Services** [Optional] - Path to the folder in the linked artifact in which contains the JSON definitions for the Linked Services
- **Path to Datasets** [Optional] - Path to the folder in the linked artifact in which contains the JSON definitions for the Datasets
- **Path to Pipelines** [Optional] - Path to the folder in the linked artifact in which contains the JSON definitions for the Pipelines
- **Path to Triggers** [Optional] - Path to the folder in the linked artifact in which contains the JSON definitions for the Triggers. Only available in V2.

Advanced:

- **Continue on Error** - Option to continue deploying after errors occur.

## Release notes

**2.0.0** **PREVIEW**

- Rewrite to platform independent version by using NodeJS and REST APIs
- This version only support Azure Data Factory v2
- Readme updated to version 2 functionality

**1.1.8**

- Add support for Azure Data Factory V2

**1.0.2**

- Add extra error logging

**1.0.0**

- Initial public release