# Azure Data Factory Pipelines Management (Deprecated)

This release task can be added to a release pipeline to either suspend or resume all pipelines of an Azure Data Factory.
![](../images/screenshot-3.png)

## Parameters

Azure Details:
- **Azure Connection Type** - Only Azure Resource Manager is supported
- **Azure RM Subscription** - Which Azure Subscription (Service Endpoint) should be used to connect to the datafactory
- **Resource Group** - To which Resource Group is the Azure Data Factory deployed
- **Azure Data Factory** - The name of the Azure Data Factory

Data Factory Details:
- **Set Pipeline Status** - Option to set the status all the available pipelines to either 'Suspend' or 'Resume'.
- **Parallel tasks** - [Future use]Option to set the number of parallel processes.

## Release notes

**1.0.5**
- [Bug]Fixed Suspend/Resume logic

**1.0.0**
- Initial public release