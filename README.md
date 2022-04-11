# Azure Data Factory

This extension adds release tasks related to Azure Data Factory (V1 and V2) to release pipelines of Azure DevOps.

## Build status

| Branch  | status                                                                                                                                                                                                                           |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Main    | [![Build and test](https://github.com/liprec/vsts-publish-adf/workflows/Build%20and%20test/badge.svg?branch=main)](https://github.com/liprec/vsts-publish-adf/actions?query=branch%3Amain+workflow%3A%22Build+and+test%22)       |
| Develop | [![Build and test](https://github.com/liprec/vsts-publish-adf/workflows/Build%20and%20test/badge.svg?branch=develop)](https://github.com/liprec/vsts-publish-adf/actions?query=branch%3Adevelop+workflow%3A%22Build+and+test%22) |

## Azure Data Factory Azure DevOps tasks

See https://azurebi-docs.jppp.org/vsts-extensions/azure-data-factory.html for the complete documentation.

## Release notes

### **2.5**

-   Added support for Government Clouds, US, China, and Germany
-   Added support for Azure Synapse Analytics

**2.3**

-   Added support for dependencies between pipelines and linked services
-   Added release gate (serverless task) for active runs
-   Changed filters (trigger/delete task) to RegEx filters

**2.2**

-   Added support for deploy Data flows definition files
-   Added paging support for data factories with more than 50 objects
-   Adding support for trigger parameter files

**2.0.0**

-   Added new task: Delete Items
-   Added new task: Toggle Pipeline
-   Rewrite to platform independent version by using NodeJS and REST APIs
-   This version only support Azure Data Factory v2
-   Readme updated to version 2 functionality

**1.5.7**

-   Added support for V2 deployments
-   Added trigger start/stop task (V2)

**1.0.7**

-   Add extra error logging

**1.0.5**

-   [Bug] Fixed suspend/resume logic

**1.0.0**

-   Initial public release
