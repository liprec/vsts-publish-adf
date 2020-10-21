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

import throat from "throat";
import * as task from "azure-pipelines-task-lib/task";
import * as path from "path";
import * as fs from "fs";
import * as msRestAzure from "ms-rest-azure";
import { TaskParameters, SortingDirection } from "./models/taskParameters";
import { AzureModels } from "./models/azureModels";

import AzureServiceClient = msRestAzure.AzureServiceClient;
import { UrlBasedRequestPrepareOptions } from "ms-rest";

task.setResourcePath(path.join(__dirname, "../task.json"));

enum DatafactoryTypes {
    Pipeline = "pipeline",
    Dataflow = "dataflow",
    Dataset = "dataset",
    Trigger = "trigger",
    LinkedService = "linked service",
}

interface DatafactoryOptions {
    azureClient?: AzureServiceClient;
    subscriptionId: string;
    resourceGroup: string;
    dataFactoryName: string;
}

interface DatafactoryTaskOptions {
    continue: boolean;
    throttle: number;
    sorting: SortingDirection;
    detectDependency: boolean;
}

interface DatafactoryDeployObject {
    name: string;
    json: string;
    size: number;
    type: DatafactoryTypes;
    dependency: string[];
    bucket: number;
}

function loginAzure(clientId: string, key: string, tenantID: string): Promise<AzureServiceClient> {
    return new Promise<AzureServiceClient>((resolve, reject) => {
        msRestAzure.loginWithServicePrincipalSecret(clientId, key, tenantID, (err, credentials) => {
            if (err) {
                task.error(task.loc("Generic_LoginAzure", err.message));
                reject(task.loc("Generic_LoginAzure", err.message));
            }
            resolve(new AzureServiceClient(credentials, {}));
        });
    });
}

function checkDataFactory(datafactoryOption: DatafactoryOptions): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
        let azureClient: AzureServiceClient = datafactoryOption.azureClient,
            subscriptionId: string = datafactoryOption.subscriptionId,
            resourceGroup: string = datafactoryOption.resourceGroup,
            dataFactoryName: string = datafactoryOption.dataFactoryName;
        let options: UrlBasedRequestPrepareOptions = {
            method: "GET",
            url: `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DataFactory/factories/${dataFactoryName}?api-version=2018-06-01`,
            serializationMapper: null,
            deserializationMapper: null,
        };
        let request = azureClient.sendRequest(options, (err, result, request, response) => {
            if (err) {
                task.error(task.loc("Generic_CheckDataFactory", err));
                reject(task.loc("Generic_CheckDataFactory", err));
            }
            if (response.statusCode !== 200) {
                task.error(task.loc("Generic_CheckDataFactory2", dataFactoryName));
                reject(task.loc("Generic_CheckDataFactory2", dataFactoryName));
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
): Promise<DatafactoryDeployObject[]> {
    return new Promise<DatafactoryDeployObject[]>((resolve, reject) => {
        let sourceFolder = path.normalize(folder);
        let allPaths: string[] = task.find(sourceFolder); // default find options (follow sym links)
        let matchedFiles: string[] = allPaths.filter((itemPath: string) => !task.stats(itemPath).isDirectory()); // filter-out directories
        if (matchedFiles.length > 0) {
            taskOptions.sorting === SortingDirection.Ascending
                ? matchedFiles.sort(
                      (item1, item2) =>
                          <any>(path.basename(item1) > path.basename(item2)) -
                          <any>(path.basename(item1) < path.basename(item2))
                  )
                : matchedFiles.sort(
                      (item1, item2) =>
                          <any>(path.basename(item2) > path.basename(item1)) -
                          <any>(path.basename(item2) < path.basename(item1))
                  );
            console.log(`Found ${matchedFiles.length} ${datafactoryType}(s) definitions.`);
            resolve(
                matchedFiles.map((file: string) => {
                    let data = fs.readFileSync(file, "utf8");
                    let json = JSON.parse(data);
                    let name = json.name || path.parse(file).name.replace(" ", "_");
                    const size = data.length;
                    let dependency;
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

function findDependency(json: any, type: string): string[] {
    let refs: string[] = [];
    if (json.referenceName && json.type === type) {
        return [json.referenceName];
    }
    for (const key in json) {
        if (typeof json[key] === typeof [Object]) refs = refs.concat(findDependency(json[key], type));
    }
    return refs.filter((current: string, index: number, array: string[]) => array.indexOf(current) === index);
}

function deployItem(
    datafactoryOption: DatafactoryOptions,
    taskOptions: DatafactoryTaskOptions,
    item: DatafactoryDeployObject
): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
        let azureClient: AzureServiceClient = datafactoryOption.azureClient,
            subscriptionId: string = datafactoryOption.subscriptionId,
            resourceGroup: string = datafactoryOption.resourceGroup,
            dataFactoryName: string = datafactoryOption.dataFactoryName;
        let objectName = item.name;
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
        let options: UrlBasedRequestPrepareOptions = {
            method: "PUT",
            url: `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DataFactory/factories/${dataFactoryName}/${objectType}/${objectName}?api-version=2018-06-01`,
            serializationMapper: null,
            deserializationMapper: null,
            headers: {
                "Content-Type": "application/json",
            },
            body: item.json,
            disableJsonStringifyOnBody: true,
        };
        let request = azureClient.sendRequest(options, (err, result, request, response) => {
            if (err && !taskOptions.continue) {
                task.error(task.loc("DeployAdfJson_DeployItems2", item.name, item.type, err.message));
                reject(task.loc("DeployAdfJson_DeployItems2", item.name, item.type, err.message));
            } else if (response.statusCode !== 200) {
                if (taskOptions.continue) {
                    task.warning(task.loc("DeployAdfJson_DeployItems2", item.name, item.type, JSON.stringify(result)));
                    resolve(false);
                } else {
                    reject(task.loc("DeployAdfJson_DeployItems2", item.name, item.type, JSON.stringify(result)));
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
    if (hasError) {
        return;
    } // Some error occurred, so returning
    return new Promise<boolean>((resolve, reject) => {
        getObjects(datafactoryType, taskOptions, folder)
            .then((items: DatafactoryDeployObject[]) => {
                const numberOfBuckets = splitBuckets(taskOptions.detectDependency, items);
                const invalidItems = items.filter((item: DatafactoryDeployObject) => item.bucket === -1);
                if (invalidItems.length !== 0) {
                    task.debug(
                        task.loc(
                            "DeployAdfJson_Depencency",
                            datafactoryType,
                            invalidItems.map((item: DatafactoryDeployObject) => item.name).join(", ")
                        )
                    );
                    reject(
                        task.loc(
                            "DeployAdfJson_Depencency",
                            datafactoryType,
                            invalidItems.map((item: DatafactoryDeployObject) => item.name).join(", ")
                        )
                    );
                }
                processItems(datafactoryOption, taskOptions, datafactoryType, items, numberOfBuckets)
                    .catch((err) => {
                        reject(err);
                    })
                    .then((result: boolean) => {
                        resolve(result);
                    });
            })
            .catch((err) => {
                task.debug(task.loc("DeployAdfJson_DeployItems", folder, err.message));
                reject(task.loc("DeployAdfJson_DeployItems", folder, err.message));
            });
    });
}

function splitBuckets(detectDependency: boolean, items: DatafactoryDeployObject[]): number {
    let loop = detectDependency;
    let change = true;
    let numberOfBuckets = 1;
    while (loop || change) {
        loop = false;
        change = false;
        const loopItems = items.filter((item: DatafactoryDeployObject) => item.bucket === -1);
        loopItems.forEach((item: DatafactoryDeployObject) => {
            const pBucket = item.bucket;
            const buckets = item.dependency.map((i) => items.find((item) => item.name === i).bucket);
            if (Math.min(...buckets) !== -1) {
                numberOfBuckets++;
                change = true;
                item.bucket = Math.max(...buckets) + 1;
            }
            loop = pBucket !== item.bucket;
        });
    }
    return numberOfBuckets;
}

function getReadableFileSize(fileSizeInBytes: number): string {
    var i = 0;
    var byteUnits = [" bytes", " kB", " MB", " GB", " TB", "PB", "EB", "ZB", "YB"];
    while (fileSizeInBytes > 1024) {
        fileSizeInBytes = fileSizeInBytes / 1024;
        i++;
    }

    return Math.max(fileSizeInBytes, 0.1).toFixed(1) + byteUnits[i];
}

function getReadableInterval(interval: number): string {
    let x = interval / 1000;
    const seconds = x % 60;
    x /= 60;
    const minutes = Math.floor(x % 60);
    x /= 60;
    const hours = Math.floor(x % 24);
    let r = "";
    if (hours !== 0) r += hours + " hours ";
    if (minutes !== 0) r += (minutes < 10 ? "0" : "") + minutes + " minutes ";
    return r + seconds + " seconds";
}

function processItems(
    datafactoryOption: DatafactoryOptions,
    taskOptions: DatafactoryTaskOptions,
    datafactoryType: DatafactoryTypes,
    items: DatafactoryDeployObject[],
    numberOfBuckets: number
): Promise<boolean> {
    let firstError;
    return new Promise<boolean>((resolve, reject) => {
        let totalItems = 0;
        let size = 0;
        let start: number = Date.now();
        const runs: DatafactoryDeployObject[][] = Array.from({ length: numberOfBuckets }, (_, index: number) =>
            items.filter((item: DatafactoryDeployObject) => item.bucket === index)
        );
        console.log(
            `Start deploying ${items.length} ${datafactoryType}(s) in ${numberOfBuckets} chunk(s) with ${taskOptions.throttle} thread(s).`
        );
        runs.reduce((promiseChain, currentTask) => {
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
            .then((arrayOfResults: any) => {
                const duration = Date.now() - start;
                console.log(`${totalItems} ${datafactoryType}(s) deployed.\n\nStats:`);
                console.log(`======`);
                console.log(`Total size:\t${getReadableFileSize(size)}.`);
                console.log(`Duration:\t${getReadableInterval(duration)}.`);
                console.log(`Performance:\t${getReadableFileSize(size / (duration / 1000))}/sec.`);
                console.log(`\t\t${(totalItems / (duration / 1000)).toFixed(1)} items/sec.`);
                if (hasError) {
                    reject(firstError);
                } else {
                    let issues = arrayOfResults.flat().filter((result) => {
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
    let promise = new Promise<boolean>(async (resolve, reject) => {
        let taskParameters: TaskParameters;
        let azureModels: AzureModels;

        try {
            let debugMode: string = task.getVariable("System.Debug");
            let isVerbose: boolean = debugMode ? debugMode.toLowerCase() != "false" : false;

            task.debug("Task execution started ...");
            taskParameters = new TaskParameters();
            let connectedServiceName = taskParameters.ConnectedServiceName;
            let resourceGroup = taskParameters.ResourceGroupName;
            let dataFactoryName = taskParameters.DatafactoryName;

            let servicePath = taskParameters.ServicePath;
            let pipelinePath = taskParameters.PipelinePath;
            let datasetPath = taskParameters.DatasetPath;
            let dataflowPath = taskParameters.DataflowPath;
            let triggerPath = taskParameters.TriggerPath;

            let taskOptions = {
                continue: taskParameters.Continue,
                throttle: taskParameters.Throttle,
                sorting: taskParameters.Sorting,
                detectDependency: taskParameters.DetectDependency,
            };

            azureModels = new AzureModels(connectedServiceName);
            let clientId = azureModels.getServicePrincipalClientId();
            let key = azureModels.getServicePrincipalKey();
            let tenantID = azureModels.getTenantId();
            let datafactoryOption: DatafactoryOptions = {
                subscriptionId: azureModels.getSubscriptionId(),
                resourceGroup: resourceGroup,
                dataFactoryName: dataFactoryName,
            };
            let firstError;
            task.debug("Parsed task inputs");

            loginAzure(clientId, key, tenantID)
                .then((azureClient: AzureServiceClient) => {
                    datafactoryOption.azureClient = azureClient;
                    task.debug("Azure client retrieved.");
                    return checkDataFactory(datafactoryOption);
                })
                .then(() => {
                    task.debug(`Datafactory '${dataFactoryName}' exist`);
                    let deployTasks = [];
                    if (servicePath !== null) {
                        deployTasks.push({ path: servicePath, type: DatafactoryTypes.LinkedService });
                    }
                    if (datasetPath !== null) {
                        deployTasks.push({ path: datasetPath, type: DatafactoryTypes.Dataset });
                    }
                    if (dataflowPath !== null) {
                        deployTasks.push({ path: dataflowPath, type: DatafactoryTypes.Dataflow });
                    }
                    if (pipelinePath !== null) {
                        deployTasks.push({ path: pipelinePath, type: DatafactoryTypes.Pipeline });
                    }
                    if (triggerPath !== null) {
                        deployTasks.push({ path: triggerPath, type: DatafactoryTypes.Trigger });
                    }
                    Promise.all(
                        deployTasks.map(
                            throat(1, (task) => {
                                return deployItems(datafactoryOption, taskOptions, task.path, task.type);
                            })
                        )
                    )
                        .catch((err) => {
                            hasError = true;
                            firstError = firstError || err;
                        })
                        .then((results: any) => {
                            if (hasError) {
                                reject(firstError);
                            } else {
                                let issues = results.filter((result) => {
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
        task.setResult(result ? task.TaskResult.Succeeded : task.TaskResult.SucceededWithIssues, "");
    })
    .catch((err) => {
        task.setResult(task.TaskResult.Failed, err);
    });
