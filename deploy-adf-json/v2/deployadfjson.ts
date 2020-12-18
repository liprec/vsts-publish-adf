/*
 * Azure Pipelines Azure Datafactory Deploy Task
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

"use sctrict";

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
    find,
    stats,
} from "azure-pipelines-task-lib/task";
import { basename, join, normalize, parse } from "path";
import { readFileSync } from "fs";
import { AzureServiceClient, loginWithServicePrincipalSecret } from "ms-rest-azure";
import { UrlBasedRequestPrepareOptions, Mapper } from "ms-rest";

import { TaskParameters } from "./models/taskParameters";
import { AzureModels } from "./models/azureModels";
import { DatafactoryTypes, SortingDirection } from "./lib/enums";
import { addSummary, findDependency, splitBuckets } from "./lib/helpers";
import { DatafactoryTaskObject, DatafactoryOptions, DatafactoryTaskOptions } from "./lib/interfaces";

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
    datafactoryType: DatafactoryTypes,
    taskOptions: DatafactoryTaskOptions,
    folder: string
): Promise<DatafactoryTaskObject[]> {
    return new Promise<DatafactoryTaskObject[]>((resolve, reject) => {
        const sourceFolder = normalize(folder);
        const allPaths: string[] = find(sourceFolder); // default find options (follow sym links)
        const matchedFiles: string[] = allPaths.filter((itemPath: string) => !stats(itemPath).isDirectory()); // filter-out directories
        if (matchedFiles.length > 0) {
            taskOptions.sorting === SortingDirection.Ascending
                ? matchedFiles.sort(
                      (item1, item2) =>
                          <any>(basename(item1) > basename(item2)) - <any>(basename(item1) < basename(item2))
                  )
                : matchedFiles.sort(
                      (item1, item2) =>
                          <any>(basename(item2) > basename(item1)) - <any>(basename(item2) < basename(item1))
                  );
            console.log(`Found ${matchedFiles.length} ${datafactoryType}(s) definitions.`);
            resolve(
                matchedFiles.map((file: string) => {
                    const data = readFileSync(file, "utf8");
                    const json = JSON.parse(data);
                    const name = json.name || parse(file).name.replace(" ", "_");
                    const size = data.length;
                    let dependency: string[];
                    switch (datafactoryType) {
                        case DatafactoryTypes.LinkedService:
                            dependency = taskOptions.detectDependency
                                ? findDependency(json, "LinkedServiceReference")
                                : [];
                            break;
                        case DatafactoryTypes.Pipeline:
                            dependency = taskOptions.detectDependency ? findDependency(json, "PipelineReference") : [];
                            break;
                        default:
                            dependency = [];
                            break;
                    }

                    return {
                        name,
                        json: JSON.stringify(json),
                        type: datafactoryType,
                        size,
                        dependency,
                        bucket: dependency.length === 0 ? 0 : -1,
                    };
                })
            );
        }
    });
}

function deployItem(
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
            case DatafactoryTypes.Dataflow:
                objectType = "dataflows";
                break;
            case DatafactoryTypes.Dataset:
                objectType = "datasets";
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
            method: "PUT",
            url: `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DataFactory/factories/${dataFactoryName}/${objectType}/${objectName}?api-version=2018-06-01`,
            serializationMapper: <Mapper>(<unknown>undefined),
            deserializationMapper: <Mapper>(<unknown>undefined),
            headers: {
                "Content-Type": "application/json",
            },
            body: item.json,
            disableJsonStringifyOnBody: true,
        };
        const request = azureClient.sendRequest(options, (err, result, request, response) => {
            if (err && !taskOptions.continue) {
                error(loc("DeployAdfJson_DeployItems2", item.name, item.type, err.message));
                reject(loc("DeployAdfJson_DeployItems2", item.name, item.type, err.message));
            } else if (response && response.statusCode !== 200) {
                if (taskOptions.continue) {
                    warning(loc("DeployAdfJson_DeployItems2", item.name, item.type, JSON.stringify(result)));
                    resolve(false);
                } else {
                    error(loc("DeployAdfJson_DeployItems2", item.name, item.type, JSON.stringify(result)));
                    reject(loc("DeployAdfJson_DeployItems2", item.name, item.type, JSON.stringify(result)));
                }
            } else {
                console.log(`Deployed ${item.type} '${item.name}' in chunk: ${item.bucket}.`);
                resolve(true);
            }
        });
    });
}

function deployItems(
    datafactoryOption: DatafactoryOptions,
    taskOptions: DatafactoryTaskOptions,
    folder: string,
    datafactoryType: DatafactoryTypes
): Promise<boolean> {
    // Some error occurred, so returning
    if (hasError) return Promise.reject(true);
    return new Promise<boolean>((resolve, reject) => {
        getObjects(datafactoryType, taskOptions, folder)
            .then((items: DatafactoryTaskObject[]) => {
                const numberOfBuckets = splitBuckets(taskOptions.detectDependency, items);
                if (numberOfBuckets === -1) {
                    debug(loc("DeployAdfJson_Depencency2", datafactoryType));
                    reject(loc("DeployAdfJson_Depencency2", datafactoryType));
                }
                const invalidItems = items.filter((item: DatafactoryTaskObject) => item.bucket === -1);
                if (invalidItems.length !== 0) {
                    debug(
                        loc(
                            "DeployAdfJson_Depencency",
                            datafactoryType,
                            invalidItems.map((item: DatafactoryTaskObject) => item.name).join(", ")
                        )
                    );
                    reject(
                        loc(
                            "DeployAdfJson_Depencency",
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
                debug(loc("DeployAdfJson_DeployItems", folder, err.message));
                reject(loc("DeployAdfJson_DeployItems", folder, err.message));
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
        let size = 0;
        const start: number = Date.now();
        const runs: DatafactoryTaskObject[][] = Array.from({ length: numberOfBuckets }, (_, index: number) =>
            items.filter((item: DatafactoryTaskObject) => item.bucket === index)
        );
        console.log(
            `Start deploying ${items.length} ${datafactoryType}(s) in ${numberOfBuckets} chunk(s) with ${taskOptions.throttle} thread(s).`
        );
        runs.reduce((promiseChain: Promise<any>, currentTask: DatafactoryTaskObject[]) => {
            return promiseChain.then((chainResults) =>
                Promise.all(
                    currentTask.map(
                        throat(taskOptions.throttle, (item) => {
                            size += item.size;
                            totalItems++;
                            return deployItem(datafactoryOption, taskOptions, item);
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
            .then((arrayOfResults: any) => {
                const duration = Date.now() - start;
                addSummary(totalItems, issues, datafactoryType, "deployed", size, duration);
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

            const servicePath = taskParameters.ServicePath;
            const pipelinePath = taskParameters.PipelinePath;
            const datasetPath = taskParameters.DatasetPath;
            const dataflowPath = taskParameters.DataflowPath;
            const triggerPath = taskParameters.TriggerPath;

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
                .then(() => {
                    debug(`Datafactory '${dataFactoryName}' exist`);
                    const deployTasks: any[] = [];
                    if (servicePath) {
                        deployTasks.push({ path: servicePath, type: DatafactoryTypes.LinkedService });
                    }
                    if (datasetPath) {
                        deployTasks.push({ path: datasetPath, type: DatafactoryTypes.Dataset });
                    }
                    if (dataflowPath) {
                        deployTasks.push({ path: dataflowPath, type: DatafactoryTypes.Dataflow });
                    }
                    if (pipelinePath) {
                        deployTasks.push({ path: pipelinePath, type: DatafactoryTypes.Pipeline });
                    }
                    if (triggerPath) {
                        deployTasks.push({ path: triggerPath, type: DatafactoryTypes.Trigger });
                    }
                    Promise.all(
                        deployTasks.map(
                            throat(1, (task: any) => {
                                return deployItems(datafactoryOption, taskOptions, task.path, task.type);
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

// Set generic error flag
let hasError = false;

main()
    .then((result) => {
        setResult(result ? TaskResult.Succeeded : TaskResult.SucceededWithIssues, "");
    })
    .catch((err) => {
        setResult(TaskResult.Failed, err);
    });
