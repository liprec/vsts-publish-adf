[![Build Status](https://ci.appveyor.com/api/projects/status/github/liprec/vsts-publish-adf?branch=master&svg=true)](https://ci.appveyor.com/project/liprec/vsts-publish-adf)

# Azure Data Factory

This extension adds release tasks related to Azure Data Factory (V1 and V2) to Visual Studio Team Service.

## Azure Data Factory Deployment

Visual Studio Team Service deploy task that will deploy JSON files with definition of Linked Services, Datasets, Pipelines and/or Triggers (V2) to an existing Azure Data Factory. 
![](images/screenshot-2.png)

[More information](deploy-adf-json/README.md)

## Azure Data Factory Pipelines Management

This release task can be added to a release pipeline to either start or stop Azure Data Factory V2 triggers.
![](images/screenshot-4.png)

[More information](toggle-adf-trigger/README.md)

## Azure Data Factory Pipelines Management

This release task can be added to a release pipeline to either suspend or resume all pipelines of an Azure Data Factory.
![](images/screenshot-3.png)

[More information](suspend-adf-pipeline/README.md)

## Release notes

**1.5.0**
- Added support for V2 deployments
- Added trigger start/stop task (V2)

**1.0.7**
- Add extra error logging

**1.0.5**
- [Bug] Fixed suspend/resume logic

**1.0.0**
- Initial public release