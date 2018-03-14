# Azure Data Factory (V2) Trigger

This release task can be added to a release pipeline to either start or stop Azure Data Factory triggers.
![](../images/screenshot-4.png)

## Parameters

Azure Details:
- **Azure Connection Type** - Only Azure Resource Manager is supported
- **Azure RM Subscription** - Which Azure Subscription (Service Endpoint) should be used to connect to the datafactory
- **Resource Group** - To which Resource Group is the Azure Data Factory deployed

Data Factory Details:
- **Azure Data Factory** - The name of the Azure Data Factory.
- **Trigger name** - The name of the Trigger [Optional]. If not defined all trigger will be start/stop.
- **Set Trigger Status** - The status of the stigger: Start or Stop.

## Release notes

**1.0.0**
- Initial public release