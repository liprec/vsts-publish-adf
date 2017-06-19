# Azure Data Factory

This extension adds release tasks related to Azure Data Factory to Visual Studio Team Service.

## Azure Data Factory Deployment

Visual Studio Team Service deploy task that will deploy JSON files with definition of Linked Services, Datasets and/or Pipelines to an existing Azure Data Factory. 
![](images/screenshot-2.png)

[More information](deploy-adf-json/README.md)

## Azure Data Factory Pipelines Management

This release task can be added to a release pipeline to either suspend or resume all pipelines of an Azure Data Factory.
![](images/screenshot-3.png)

[More information](suspend-adf-pipeline/README.md)

## Release notes

**1.0.6**
- Add extra error logging

**1.0.5**
- [Bug] Fixed suspend/resume logic

**1.0.0**
- Initial public release