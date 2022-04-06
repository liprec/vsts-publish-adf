/*
 * Azure Pipelines Azure Datafactory Deploy Task
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

"use sctrict";

import throat from "throat";
import {
    error,
    warning,
    loc,
    setResourcePath,
    debug,
    TaskResult,
    setResult,
    find,
    stats,
} from "azure-pipelines-task-lib/task";
import { basename, join, normalize, parse } from "path";
import { readFileSync } from "fs";
import {
    loginWithServicePrincipalSecret,
    loginWithAppServiceMSI,
    ApplicationTokenCredentials,
    MSIAppServiceTokenCredentials,
    AzureTokenCredentialsOptions,
} from "@azure/ms-rest-nodeauth";
import { AzureServiceClient } from "@azure/ms-rest-azure-js";
import { HttpOperationResponse, RequestPrepareOptions } from "@azure/ms-rest-js";

import { TaskParameters } from "./models/taskParameters";
import { AzureModels } from "./models/azureModels";
import { DatafactoryTypes, SortingDirection } from "./lib/enums";
import { addSummary, findDependency, splitBuckets } from "./lib/helpers";
import { DatafactoryTaskObject, DatafactoryOptions, DatafactoryTaskOptions, DeployTask } from "./lib/interfaces";

setResourcePath(join(__dirname, "../task.json"));

function loginAzure(
    clientId: string,
    key: string,
    tenantID: string,
    scheme: string,
    audience?: string
): Promise<AzureServiceClient> {
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
            const options: AzureTokenCredentialsOptions = audience
                ? {
                      tokenAudience: audience,
                  }
                : {};
            loginWithServicePrincipalSecret(clientId, key, tenantID, options)
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
            environmentUrl: string = datafactoryOption.environmentUrl,
            subscriptionId: string = datafactoryOption.subscriptionId,
            resourceGroup: string | undefined = datafactoryOption.resourceGroup,
            dataFactoryName: string | undefined = datafactoryOption.dataFactoryName;
        const options: RequestPrepareOptions = {
            method: "GET",
            url: `https://${environmentUrl}/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DataFactory/factories/${dataFactoryName}?api-version=2018-06-01`,
        };
        azureClient
            .sendRequest(options)
            .then((result: HttpOperationResponse) => {
                if (result && result.status !== 200) {
                    error(loc("Generic_CheckDataFactory2", dataFactoryName));
                    reject(loc("Generic_CheckDataFactory2", dataFactoryName));
                } else {
                    debug(`Datafactory '${dataFactoryName}' exist`);
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
    datafactoryType: DatafactoryTypes,
    taskOptions: DatafactoryTaskOptions,
    folder: string
): Promise<DatafactoryTaskObject[]> {
    return new Promise<DatafactoryTaskObject[]>((resolve) => {
        const sourceFolder = normalize(folder);
        const allPaths: string[] = find(sourceFolder); // default find options (follow sym links)
        const matchedFiles: string[] = allPaths.filter((itemPath: string) => !stats(itemPath).isDirectory()); // filter-out directories
        if (matchedFiles.length > 0) {
            taskOptions.sorting === SortingDirection.Ascending
                ? matchedFiles.sort(
                      (item1, item2) =>
                          ((basename(item1) > basename(item2)) as unknown as number) -
                          ((basename(item1) < basename(item2)) as unknown as number)
                  )
                : matchedFiles.sort(
                      (item1, item2) =>
                          ((basename(item2) > basename(item1)) as unknown as number) -
                          ((basename(item2) < basename(item1)) as unknown as number)
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
        const azureClient: AzureServiceClient = datafactoryOption.azureClient as AzureServiceClient,
            subscriptionId: string = datafactoryOption.subscriptionId,
            environmentUrl: string = datafactoryOption.environmentUrl,
            workspaceUrl: string | undefined = datafactoryOption.workspaceUrl,
            resourceGroup: string | undefined = datafactoryOption.resourceGroup,
            dataFactoryName: string | undefined = datafactoryOption.dataFactoryName;
        const endPoint = workspaceUrl
            ? `https://${workspaceUrl}`
            : `https://${environmentUrl}/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DataFactory/factories/${dataFactoryName}`;
        const apiVersion = workspaceUrl ? "2020-12-01" : "2018-06-01";
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
        const options: RequestPrepareOptions = {
            method: "PUT",
            url: `${endPoint}/${objectType}/${objectName}?api-version=${apiVersion}`,
            headers: {
                "Content-Type": "application/json",
            },
            body: item.json,
            disableJsonStringifyOnBody: true,
        };
        azureClient
            .sendRequest(options)
            .then(async (result: HttpOperationResponse) => {
                if (result && result.status !== 200 && result.status !== 202) {
                    const objects = JSON.parse(JSON.stringify(result.parsedBody));
                    const cloudError = objects.error;
                    if (taskOptions.continue) {
                        warning(loc("DeployAdfJson_DeployItems2", item.name, item.type, cloudError.message));
                        resolve(false);
                    } else {
                        error(loc("DeployAdfJson_DeployItems2", item.name, item.type, cloudError.message));
                        reject(loc("DeployAdfJson_DeployItems2", item.name, item.type, cloudError.message));
                    }
                } else {
                    console.log(`Deployed ${item.type} '${item.name}' in chunk: ${item.bucket}.`);
                    resolve(true);
                }
            })
            .catch((err: Error) => {
                if (err) {
                    error(loc("DeployAdfJson_DeployItems2", item.name, item.type, err.message));
                    reject(loc("DeployAdfJson_DeployItems2", item.name, item.type, err.message));
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
                        resolve(result as boolean);
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
        runs.reduce(async (promiseChain: Promise<unknown[]>, currentTask: DatafactoryTaskObject[]) => {
            const chainResults = await promiseChain;
            const currentResult = await Promise.all(
                currentTask.map(
                    throat(taskOptions.throttle, (item) => {
                        size += item.size;
                        totalItems++;
                        return deployItem(datafactoryOption, taskOptions, item);
                    })
                )
            );
            return [...chainResults, currentResult];
        }, Promise.resolve([]))
            .catch((err: unknown) => {
                issues++;
                hasError = true;
                firstError = firstError || (err as boolean);
            })
            .then(() => {
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
    const promise = new Promise<boolean>((resolve, reject) => {
        let taskParameters: TaskParameters;
        let azureModels: AzureModels;
        let firstError: boolean;

        try {
            // const debugMode: string = getVariable("System.Debug") as string;
            // const isVerbose: boolean = debugMode ? debugMode.toLowerCase() != "false" : false;

            debug("Task execution started ...");
            taskParameters = new TaskParameters();
            const connectedServiceName = taskParameters.ConnectedServiceName;
            const workspaceUrl = taskParameters.WorkspaceUrl;
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
            const clientId = azureModels.ServicePrincipalClientId;
            const key = azureModels.ServicePrincipalKey;
            const tenantID = azureModels.TenantId;
            const datafactoryOption: DatafactoryOptions = {
                subscriptionId: azureModels.SubscriptionId,
                environmentUrl: azureModels.EnvironmentUrl,
                workspaceUrl: workspaceUrl,
                resourceGroup: resourceGroup,
                dataFactoryName: dataFactoryName,
            };
            const scheme = azureModels.AuthScheme;
            debug("Parsed task inputs");

            loginAzure(clientId, key, tenantID, scheme, taskParameters.Audience)
                .then((azureClient: AzureServiceClient) => {
                    datafactoryOption.azureClient = azureClient;
                    debug("Azure client retrieved.");
                    if (!datafactoryOption.workspaceUrl) {
                        return checkDataFactory(datafactoryOption);
                    } else {
                        return true;
                    }
                })
                .then(() => {
                    const deployTasks: DeployTask[] = [];
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
                            throat(1, (task: DeployTask) => {
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
