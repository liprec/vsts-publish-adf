# Azure Data Factory Delete Items

This task can be added to a pipeline to delete Azure Data Factory items, like Datasets, Pipelines, Linked Services or Triggers.

Full documentation: https://azurebi-docs.jppp.org/vsts-extensions/azure-data-factory-delete.html

## Release notes

**2.2**

- Added support for deleting data flow definitions
- Added paging support to delete object with data factories with more than 50 objects

**2.0**

- Rewrite to platform independent version by using NodeJS and REST APIs
- This version only support Azure Data Factory v2
- Initial public release
