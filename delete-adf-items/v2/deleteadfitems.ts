/*
 * Azure Pipelines Azure Datafactory Delete Items Task
 *
 * Copyright (c) 2020 Jan Pieter Posthuma / DataScenarios
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
import {
    error,
    warning,
    loc,
    setResourcePath,
    debug,
    getVariable,
    TaskResult,
    setResult,
} from "azure-pipelines-task-lib/task";
import { join } from "path";
import { AzureServiceClient, loginWithServicePrincipalSecret } from "ms-rest-azure";
import { UrlBasedRequestPrepareOptions, Mapper } from "ms-rest";

import { TaskParameters } from "./models/taskParameters";
import { AzureModels } from "./models/azureModels";
import { addSummary, findDependency, splitBuckets } from "./lib/helpers";
import { DatafactoryOptions, DatafactoryTaskOptions, DatafactoryTaskObject } from "./lib/interfaces";
import { DatafactoryTypes, SortingDirection } from "./lib/enums";

setResourcePath(join(__dirname, "../task.json"));

function loginAzure(clientId: string, key: string, tenantID: string): Promise<AzureServiceClient> {
    return new Promise<AzureServiceClient>((resolve, reject) => {
        loginWithServicePrincipalSecret(clientId, key, tenantID, (err, credentials) => {
            if (err) {
                error(loc("Generic_LoginAzure", err.message));
                reject(loc("Generic_LoginAzure", err.message));
            }
            resolve(new AzureServiceClient(credentials, {}));
        });
    });
}

function checkDataFactory(datafactoryOption: DatafactoryOptions): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
        const azureClient: AzureServiceClient = <AzureServiceClient>datafactoryOption.azureClient,
            subscriptionId: string = datafactoryOption.subscriptionId,
            resourceGroup: string = datafactoryOption.resourceGroup,
            dataFactoryName: string = datafactoryOption.dataFactoryName;
        const options: UrlBasedRequestPrepareOptions = {
            method: "GET",
            url: `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DataFactory/factories/${dataFactoryName}?api-version=2018-06-01`,
            serializationMapper: <Mapper>(<unknown>undefined),
            deserializationMapper: <Mapper>(<unknown>undefined),
        };
        const request = azureClient.sendRequest(options, (err, result, request, response) => {
            if (err) {
                error(loc("Generic_CheckDataFactory", err));
                reject(loc("Generic_CheckDataFactory", err));
            }
            if (response && response.statusCode !== 200) {
                error(loc("Generic_CheckDataFactory2", dataFactoryName));
                reject(loc("Generic_CheckDataFactory2", dataFactoryName));
            } else {
                resolve(true);
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
        const azureClient: AzureServiceClient = <AzureServiceClient>datafactoryOption.azureClient,
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
        const options: UrlBasedRequestPrepareOptions = {
            method: "GET",
            url: `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DataFactory/factories/${dataFactoryName}/${objectType}?api-version=2018-06-01`,
            serializationMapper: <Mapper>(<unknown>undefined),
            deserializationMapper: <Mapper>(<unknown>undefined),
        };
        const request = azureClient.sendRequest(options, async (err, result, request, response) => {
            if (err) {
                error(loc("DeleteAdfItems_GetObjects", datafactoryType, err.message));
                reject(loc("DeleteAdfItems_GetObjects", datafactoryType, err.message));
            } else if (response && response.statusCode !== 200) {
                debug(loc("DeleteAdfItems_GetObjects2", datafactoryType));
                reject(loc("DeleteAdfItems_GetObjects2", datafactoryType));
            } else {
                let objects = JSON.parse(JSON.stringify(result));
                let items = objects.value;
                let nextLink = objects.nextLink;
                while (nextLink !== undefined) {
                    const result = await processNextLink(datafactoryOption, nextLink);
                    objects = JSON.parse(JSON.stringify(result));
                    items = items.concat(objects.value);
                    nextLink = objects.nextLink;
                }
                if (filter)
                    items = items.filter((item: any) => {
                        return wildcardFilter(item.name, filter);
                    });
                taskOptions.sorting === SortingDirection.Ascending
                    ? items.sort(
                          (item1: any, item2: any) => <any>(item1.name > item2.name) - <any>(item1.name < item2.name)
                      )
                    : items.sort(
                          (item1: any, item2: any) => <any>(item2.name > item1.name) - <any>(item2.name < item1.name)
                      );
                console.log(`Found ${items.length} ${datafactoryType}(s).`);
                resolve(
                    items.map((item: any) => {
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
        });
    });
}

function processNextLink(datafactoryOption: DatafactoryOptions, nextLink: string): Promise<any> {
    const azureClient: AzureServiceClient = <AzureServiceClient>datafactoryOption.azureClient,
        options: UrlBasedRequestPrepareOptions = {
            method: "GET",
            url: nextLink,
            serializationMapper: <Mapper>(<unknown>undefined),
            deserializationMapper: <Mapper>(<unknown>undefined),
        };
    debug(`Following next link`);
    return new Promise<any>((resolve, reject) => {
        azureClient.sendRequest(options, (err, result, request, response) => {
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
        const azureClient: AzureServiceClient = <AzureServiceClient>datafactoryOption.azureClient,
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
        const options: UrlBasedRequestPrepareOptions = {
            method: "DELETE",
            url: `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DataFactory/factories/${dataFactoryName}/${objectType}/${objectName}?api-version=2018-06-01`,
            serializationMapper: <Mapper>(<unknown>undefined),
            deserializationMapper: <Mapper>(<unknown>undefined),
        };
        const request = azureClient.sendRequest(options, (err, result, request, response) => {
            if (err && !taskOptions.continue) {
                error(loc("DeleteAdfItems_DeleteItem", item.type, err.message));
                reject(loc("DeleteAdfItems_DeleteItem", item.type, err.message));
            } else if (response && (response.statusCode === 400 || response.statusCode === 429)) {
                if (taskOptions.continue) {
                    warning(loc("DeleteAdfItems_DeleteItem2", item.name, item.type, JSON.stringify(result)));
                    resolve(false);
                } else {
                    error(loc("DeleteAdfItems_DeleteItem2", item.name, item.type, JSON.stringify(result)));
                    reject(loc("DeleteAdfItems_DeleteItem2", item.name, item.type, JSON.stringify(result)));
                }
            } else if (response && response.statusCode === 204) {
                debug(`'${item.name}' not found.`);
                resolve(true);
            } else if (response && response.statusCode === 200) {
                console.log(`Deleted ${item.type} '${item.name}' in chunk: ${item.bucket}.`);
                resolve(true);
            } else {
                resolve(false);
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
                        resolve(<boolean>result);
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
        const start: number = Date.now();
        const runs: DatafactoryTaskObject[][] = Array.from({ length: numberOfBuckets }, (_, index: number) =>
            items.filter((item: DatafactoryTaskObject) => item.bucket === index)
        ).reverse();
        console.log(
            `Start deleting ${items.length} ${datafactoryType}(s) in ${numberOfBuckets} chunk(s) with ${taskOptions.throttle} thread(s).`
        );

        runs.reduce((promiseChain: Promise<any>, currentTask: DatafactoryTaskObject[]) => {
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
            .then((arrayOfResults: any) => {
                const duration = Date.now() - start;
                addSummary(totalItems, datafactoryType, "deleted", undefined, duration);
                if (hasError) {
                    reject(firstError);
                } else {
                    const issues = arrayOfResults.flat().filter((result: any) => {
                        return !result;
                    }).length;
                    if (issues > 0) {
                        resolve(false);
                    } else {
                        resolve(true);
                    }
                }
            })
            .catch((err) => {
                hasError = true;
                firstError = firstError || err;
            });
    });
}

async function main(): Promise<boolean> {
    const promise = new Promise<boolean>(async (resolve, reject) => {
        let taskParameters: TaskParameters;
        let azureModels: AzureModels;
        let firstError: boolean;

        try {
            const debugMode: string = <string>getVariable("System.Debug");
            const isVerbose: boolean = debugMode ? debugMode.toLowerCase() != "false" : false;

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
            debug("Parsed task inputs");

            loginAzure(clientId, key, tenantID)
                .then((azureClient: AzureServiceClient) => {
                    datafactoryOption.azureClient = azureClient;
                    debug("Azure client retrieved.");
                    return checkDataFactory(datafactoryOption);
                })
                .then((result) => {
                    debug(`Datafactory '${dataFactoryName}' exist`);
                    const deleteTasks = [];
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
                            throat(1, (task) => {
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
                                const issues = (<boolean[]>results).filter((result: boolean) => {
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

function wildcardFilter(value: string, rule: string) {
    return new RegExp("^" + rule.split("*").join(".*") + "$").test(value);
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
