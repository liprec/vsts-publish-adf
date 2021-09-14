/*
 * Azure Pipelines Azure Datafactory Delete Items Task
 *
 * Copyright (c) 2021 Jan Pieter Posthuma / DataScenarios
 *
 * All rights reserved.
 *
 * MIT License.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the "Software"), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

import throat from "throat";
import { error, warning, loc, setResourcePath, debug, TaskResult, setResult } from "azure-pipelines-task-lib/task";
import { join } from "path";
import {
    loginWithServicePrincipalSecret,
    loginWithAppServiceMSI,
    ApplicationTokenCredentials,
    MSIAppServiceTokenCredentials,
} from "@azure/ms-rest-nodeauth";
import { AzureServiceClient } from "@azure/ms-rest-azure-js";
import { HttpOperationResponse, RequestPrepareOptions } from "@azure/ms-rest-js";

import { TaskParameters } from "./models/taskParameters";
import { AzureModels } from "./models/azureModels";
import { addSummary, findDependency, splitBuckets } from "./lib/helpers";
import {
    DatafactoryOptions,
    DatafactoryTaskOptions,
    DatafactoryTaskObject,
    ADFJson,
    DeleteTask,
} from "./lib/interfaces";
import { DatafactoryTypes, SortingDirection } from "./lib/enums";
import { wildcardFilter } from "./lib/helpers";

setResourcePath(join(__dirname, "../task.json"));

function loginAzure(clientId: string, key: string, tenantID: string, scheme: string): Promise<AzureServiceClient> {
    return new Promise<AzureServiceClient>((resolve, reject) => {
        if (scheme.toLocaleLowerCase() === "managedserviceidentity") {
            loginWithAppServiceMSI()
                .then((credentials: MSIAppServiceTokenCredentials) => {
                    resolve(new AzureServiceClient(credentials, {}));
                })
                .catch((err: Error) => {
                    if (err) {
                        error(loc("Generic_LoginAzure", err.message));
                        reject(loc("Generic_LoginAzure", err.message));
                    }
                });
        } else {
            loginWithServicePrincipalSecret(clientId, key, tenantID)
                .then((credentials: ApplicationTokenCredentials) => {
                    resolve(new AzureServiceClient(credentials, {}));
                })
                .catch((err: Error) => {
                    if (err) {
                        error(loc("Generic_LoginAzure", err.message));
                        reject(loc("Generic_LoginAzure", err.message));
                    }
                });
        }
    });
}

function checkDataFactory(datafactoryOption: DatafactoryOptions): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
        const azureClient: AzureServiceClient = datafactoryOption.azureClient as AzureServiceClient,
            subscriptionId: string = datafactoryOption.subscriptionId,
            resourceGroup: string = datafactoryOption.resourceGroup,
            dataFactoryName: string = datafactoryOption.dataFactoryName;
        const options: RequestPrepareOptions = {
            method: "GET",
            url: `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DataFactory/factories/${dataFactoryName}?api-version=2018-06-01`,
        };
        azureClient
            .sendRequest(options)
            .then((result: HttpOperationResponse) => {
                if (result && result.status !== 200) {
                    error(loc("Generic_CheckDataFactory2", dataFactoryName));
                    reject(loc("Generic_CheckDataFactory2", dataFactoryName));
                } else {
                    resolve(true);
                }
            })
            .catch((err: Error) => {
                if (err) {
                    error(loc("Generic_CheckDataFactory", err));
                    reject(loc("Generic_CheckDataFactory", err));
                }
            });
    });
}

function getObjects(
    datafactoryOption: DatafactoryOptions,
    taskOptions: DatafactoryTaskOptions,
    datafactoryType: DatafactoryTypes,
    filter: string
): Promise<DatafactoryTaskObject[]> {
    return new Promise<DatafactoryTaskObject[]>((resolve, reject) => {
        const azureClient: AzureServiceClient = datafactoryOption.azureClient as AzureServiceClient,
            subscriptionId: string = datafactoryOption.subscriptionId,
            resourceGroup: string = datafactoryOption.resourceGroup,
            dataFactoryName: string = datafactoryOption.dataFactoryName;
        let objectType;
        switch (datafactoryType) {
            case DatafactoryTypes.Dataset:
                objectType = "datasets";
                break;
            case DatafactoryTypes.Dataflow:
                objectType = "dataflows";
                break;
            case DatafactoryTypes.Pipeline:
                objectType = "pipelines";
                break;
            case DatafactoryTypes.Trigger:
                objectType = "triggers";
                break;
            case DatafactoryTypes.LinkedService:
                objectType = "linkedservices";
                break;
        }
        const options: RequestPrepareOptions = {
            method: "GET",
            url: `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DataFactory/factories/${dataFactoryName}/${objectType}?api-version=2018-06-01`,
        };
        azureClient
            .sendRequest(options)
            .then(async (result: HttpOperationResponse) => {
                if (result && result.status !== 200) {
                    debug(loc("DeleteAdfItems_GetObjects2", datafactoryType));
                    reject(loc("DeleteAdfItems_GetObjects2", datafactoryType));
                } else {
                    let objects = JSON.parse(JSON.stringify(result.parsedBody));
                    let items = objects.value;
                    let nextLink = objects.nextLink;
                    while (nextLink !== undefined) {
                        const result = await processNextLink(datafactoryOption, nextLink);
                        objects = JSON.parse(JSON.stringify(result.parsedBody));
                        items = items.concat(objects.value);
                        nextLink = objects.nextLink;
                    }
                    if (filter) {
                        items = items.filter((item: ADFJson) => {
                            return wildcardFilter(item.name, filter);
                        });
                    }
                    taskOptions.sorting === SortingDirection.Ascending
                        ? items.sort(
                              (item1: ADFJson, item2: ADFJson) =>
                                  ((item1.name > item2.name) as unknown as number) -
                                  ((item1.name < item2.name) as unknown as number)
                          )
                        : items.sort(
                              (item1: ADFJson, item2: ADFJson) =>
                                  ((item2.name > item1.name) as unknown as number) -
                                  ((item2.name < item1.name) as unknown as number)
                          );
                    console.log(`Found ${items.length} ${datafactoryType}(s).`);
                    resolve(
                        items.map((item: ADFJson) => {
                            let dependency: string[];
                            switch (datafactoryType) {
                                case DatafactoryTypes.LinkedService:
                                    dependency = taskOptions.detectDependency
                                        ? findDependency(item, "LinkedServiceReference")
                                        : [];
                                    break;
                                case DatafactoryTypes.Pipeline:
                                    dependency = taskOptions.detectDependency
                                        ? findDependency(item, "PipelineReference")
                                        : [];
                                    break;
                                default:
                                    dependency = [];
                                    break;
                            }
                            return {
                                name: item.name,
                                type: datafactoryType,
                                dependency,
                                bucket: dependency.length === 0 ? 0 : -1,
                            };
                        })
                    );
                }
            })
            .catch((err: Error) => {
                if (err) {
                    error(loc("DeleteAdfItems_GetObjects", datafactoryType, err.message));
                    reject(loc("DeleteAdfItems_GetObjects", datafactoryType, err.message));
                }
            });
    });
}

function processNextLink(datafactoryOption: DatafactoryOptions, nextLink: string): Promise<HttpOperationResponse> {
    const azureClient: AzureServiceClient = datafactoryOption.azureClient as AzureServiceClient,
        options: RequestPrepareOptions = {
            method: "GET",
            url: nextLink,
        };
    debug(`Following next link`);
    return new Promise<HttpOperationResponse>((resolve) => {
        azureClient.sendRequest(options).then((result: HttpOperationResponse) => {
            resolve(result);
        });
    });
}

function deleteItem(
    datafactoryOption: DatafactoryOptions,
    taskOptions: DatafactoryTaskOptions,
    item: DatafactoryTaskObject
): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
        const azureClient: AzureServiceClient = datafactoryOption.azureClient as AzureServiceClient,
            subscriptionId: string = datafactoryOption.subscriptionId,
            resourceGroup: string = datafactoryOption.resourceGroup,
            dataFactoryName: string = datafactoryOption.dataFactoryName;
        const objectName = item.name;
        let objectType;
        switch (item.type) {
            case DatafactoryTypes.Dataset:
                objectType = "datasets";
                break;
            case DatafactoryTypes.Dataflow:
                objectType = "dataflows";
                break;
            case DatafactoryTypes.Pipeline:
                objectType = "pipelines";
                break;
            case DatafactoryTypes.Trigger:
                objectType = "triggers";
                break;
            case DatafactoryTypes.LinkedService:
                objectType = "linkedservices";
                break;
        }
        const options: RequestPrepareOptions = {
            method: "DELETE",
            url: `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DataFactory/factories/${dataFactoryName}/${objectType}/${objectName}?api-version=2018-06-01`,
        };
        azureClient
            .sendRequest(options)
            .then((result: HttpOperationResponse) => {
                if (result && (result.status === 400 || result.status === 429)) {
                    const objects = JSON.parse(JSON.stringify(result.parsedBody));
                    const cloudError = objects.error;
                    if (taskOptions.continue) {
                        warning(loc("DeleteAdfItems_DeleteItem2", item.name, item.type, cloudError.message));
                        resolve(false);
                    } else {
                        error(loc("DeleteAdfItems_DeleteItem2", item.name, item.type, cloudError.message));
                        reject(loc("DeleteAdfItems_DeleteItem2", item.name, item.type, cloudError.message));
                    }
                } else if (result && result.status === 204) {
                    debug(`'${item.name}' not found.`);
                    resolve(true);
                } else if (result && result.status === 200) {
                    console.log(`Deleted ${item.type} '${item.name}' in chunk: ${item.bucket}.`);
                    resolve(true);
                } else {
                    resolve(false);
                }
            })
            .catch((err: Error) => {
                if (err && !taskOptions.continue) {
                    error(loc("DeleteAdfItems_DeleteItem", item.type, err.message));
                    reject(loc("DeleteAdfItems_DeleteItem", item.type, err.message));
                }
            });
    });
}

function deleteItems(
    datafactoryOption: DatafactoryOptions,
    taskOptions: DatafactoryTaskOptions,
    filter: string,
    datafactoryType: DatafactoryTypes
): Promise<boolean> {
    // Some error occurred, so returning
    if (hasError) return Promise.reject(true);
    return new Promise<boolean>((resolve, reject) => {
        getObjects(datafactoryOption, taskOptions, datafactoryType, filter)
            .then((items: DatafactoryTaskObject[]) => {
                const numberOfBuckets = splitBuckets(taskOptions.detectDependency, items);
                if (numberOfBuckets === -1) {
                    debug(loc("DeleteAdfJson_Depencency2", datafactoryType));
                    reject(loc("DeleteAdfJson_Depencency2", datafactoryType));
                }
                const invalidItems = items.filter((item: DatafactoryTaskObject) => item.bucket === -1);
                if (invalidItems.length !== 0) {
                    debug(
                        loc(
                            "DeleteAdfJson_Depencency",
                            datafactoryType,
                            invalidItems.map((item: DatafactoryTaskObject) => item.name).join(", ")
                        )
                    );
                    reject(
                        loc(
                            "DeleteAdfJson_Depencency",
                            datafactoryType,
                            invalidItems.map((item: DatafactoryTaskObject) => item.name).join(", ")
                        )
                    );
                }
                processItems(datafactoryOption, taskOptions, datafactoryType, items, numberOfBuckets)
                    .catch((err) => {
                        reject(err);
                    })
                    .then((result: boolean | void) => {
                        resolve(result as boolean);
                    });
            })
            .catch((err) => {
                error(loc("DeleteAdfItems_DeleteItems", datafactoryType, err.message));
                reject(loc("DeleteAdfItems_DeleteItems", datafactoryType, err.message));
            });
    });
}

function processItems(
    datafactoryOption: DatafactoryOptions,
    taskOptions: DatafactoryTaskOptions,
    datafactoryType: DatafactoryTypes,
    items: DatafactoryTaskObject[],
    numberOfBuckets: number
): Promise<boolean> {
    let firstError: boolean;
    return new Promise<boolean>((resolve, reject) => {
        if (items.length === 0) return Promise.resolve(true);
        let totalItems = 0;
        let issues = 0;
        const start: number = Date.now();
        const runs: DatafactoryTaskObject[][] = Array.from({ length: numberOfBuckets }, (_, index: number) =>
            items.filter((item: DatafactoryTaskObject) => item.bucket === index)
        ).reverse();
        console.log(
            `Start deleting ${items.length} ${datafactoryType}(s) in ${numberOfBuckets} chunk(s) with ${taskOptions.throttle} thread(s).`
        );

        runs.reduce((promiseChain: Promise<unknown[]>, currentTask: DatafactoryTaskObject[]) => {
            return promiseChain.then((chainResults) =>
                Promise.all(
                    currentTask.map(
                        throat(taskOptions.throttle, (item) => {
                            totalItems++;
                            return deleteItem(datafactoryOption, taskOptions, item);
                        })
                    )
                ).then((currentResult) => [...chainResults, currentResult])
            );
        }, Promise.resolve([]))
            .catch((err) => {
                issues++;
                hasError = true;
                firstError = firstError || err;
            })
            .then(() => {
                const duration = Date.now() - start;
                addSummary(totalItems, issues, datafactoryType, "deleted", undefined, duration);
                if (hasError) {
                    reject(firstError);
                } else {
                    if (issues > 0) {
                        resolve(false);
                    } else {
                        resolve(true);
                    }
                }
            });
    });
}

async function main(): Promise<boolean> {
    const promise = new Promise<boolean>((resolve, reject) => {
        let taskParameters: TaskParameters;
        let azureModels: AzureModels;
        let firstError: boolean;

        try {
            // const debugMode: string = <string>getVariable("System.Debug");
            // const isVerbose: boolean = debugMode ? debugMode.toLowerCase() != "false" : false;

            debug("Task execution started ...");
            taskParameters = new TaskParameters();
            const connectedServiceName = taskParameters.ConnectedServiceName;
            const resourceGroup = taskParameters.ResourceGroupName;
            const dataFactoryName = taskParameters.DatafactoryName;

            const serviceFilter = taskParameters.ServiceFilter;
            const pipelineFilter = taskParameters.PipelineFilter;
            const dataflowFilter = taskParameters.DataflowFilter;
            const datasetFilter = taskParameters.DatasetFilter;
            const triggerFilter = taskParameters.TriggerFilter;

            const taskOptions = {
                continue: taskParameters.Continue,
                throttle: taskParameters.Throttle,
                sorting: taskParameters.Sorting,
                detectDependency: taskParameters.DetectDependency,
            };

            azureModels = new AzureModels(connectedServiceName);
            const clientId = azureModels.getServicePrincipalClientId();
            const key = azureModels.getServicePrincipalKey();
            const tenantID = azureModels.getTenantId();
            const datafactoryOption: DatafactoryOptions = {
                subscriptionId: azureModels.getSubscriptionId(),
                resourceGroup: resourceGroup,
                dataFactoryName: dataFactoryName,
            };
            const scheme = azureModels.AuthScheme;
            debug("Parsed task inputs");

            loginAzure(clientId, key, tenantID, scheme)
                .then((azureClient: AzureServiceClient) => {
                    datafactoryOption.azureClient = azureClient;
                    debug("Azure client retrieved.");
                    return checkDataFactory(datafactoryOption);
                })
                .then(() => {
                    debug(`Datafactory '${dataFactoryName}' exist`);
                    const deleteTasks: DeleteTask[] = [];
                    if (triggerFilter) {
                        deleteTasks.push({ filter: triggerFilter, type: DatafactoryTypes.Trigger });
                    }
                    if (pipelineFilter) {
                        deleteTasks.push({ filter: pipelineFilter, type: DatafactoryTypes.Pipeline });
                    }
                    if (dataflowFilter) {
                        deleteTasks.push({ filter: dataflowFilter, type: DatafactoryTypes.Dataflow });
                    }
                    if (datasetFilter) {
                        deleteTasks.push({ filter: datasetFilter, type: DatafactoryTypes.Dataset });
                    }
                    if (serviceFilter) {
                        deleteTasks.push({ filter: serviceFilter, type: DatafactoryTypes.LinkedService });
                    }
                    Promise.all(
                        deleteTasks.map(
                            throat(1, (task: DeleteTask) => {
                                return deleteItems(datafactoryOption, taskOptions, task.filter, task.type);
                            })
                        )
                    )
                        .catch((err) => {
                            hasError = true;
                            firstError = firstError || err;
                        })
                        .then((results: boolean[] | void) => {
                            if (hasError) {
                                reject(firstError);
                            } else {
                                const issues = (results as boolean[]).filter((result: boolean) => {
                                    return !result;
                                }).length;
                                if (issues > 0) {
                                    resolve(false);
                                } else {
                                    resolve(true);
                                }
                            }
                        });
                })
                .catch((err) => {
                    reject(err.message);
                });
        } catch (exception) {
            reject(exception);
        }
    });
    return promise;
}

// Set generic error flag
let hasError = false;

main()
    .then((result) => {
        setResult(result ? TaskResult.Succeeded : TaskResult.SucceededWithIssues, "");
    })
    .catch((err) => {
        setResult(TaskResult.Failed, err);
    });
