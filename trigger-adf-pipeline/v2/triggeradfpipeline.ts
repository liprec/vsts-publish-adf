/*
 * Azure Pipelines Azure Datafactory Pipeline Task
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

import { all } from "q";
import throat from "throat";
import {
    error,
    warning,
    debug,
    loc,
    getVariable,
    setResourcePath,
    setVariable,
    setResult,
    TaskResult,
} from "azure-pipelines-task-lib/task";
import { join } from "path";
import { readFileSync } from "fs";
import { AzureServiceClient, loginWithServicePrincipalSecret } from "ms-rest-azure";
import { UrlBasedRequestPrepareOptions } from "ms-rest";

import { TaskParameters, PipelineParameterType } from "./models/taskParameters";
import { AzureModels } from "./models/azureModels";

setResourcePath(join(__dirname, "../task.json"));

enum DatafactoryTypes {
    Pipeline = "Pipeline",
    Dataset = "Dataset",
    Trigger = "Trigger",
    LinkedService = "Linked Service",
}

interface DatafactoryOptions {
    azureClient?: AzureServiceClient;
    subscriptionId: string;
    resourceGroup: string;
    dataFactoryName: string;
}

interface DataFactoryDeployOptions {
    continue: boolean;
    throttle: number;
    deploymentOutputs: string;
}

interface DatafactoryPipelineObject {
    pipelineName: string;
    json?: string;
}

interface DataFactoryRunResult {
    pipeline: string;
    runId: string;
}

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
                error(loc("Generic_CheckDataFactory", err));
                reject(loc("Generic_CheckDataFactory", err));
            }
            if (response.statusCode !== 200) {
                error(loc("Generic_CheckDataFactory2", dataFactoryName));
                reject(loc("Generic_CheckDataFactory2", dataFactoryName));
            } else {
                resolve(true);
            }
        });
    });
}

function getPipelines(
    datafactoryOption: DatafactoryOptions,
    filter: string,
    parameter: string
): Promise<DatafactoryPipelineObject[]> {
    return new Promise<DatafactoryPipelineObject[]>((resolve, reject) => {
        let azureClient: AzureServiceClient = datafactoryOption.azureClient,
            subscriptionId: string = datafactoryOption.subscriptionId,
            resourceGroup: string = datafactoryOption.resourceGroup,
            dataFactoryName: string = datafactoryOption.dataFactoryName;
        let options: UrlBasedRequestPrepareOptions = {
            method: "GET",
            url: `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DataFactory/factories/${dataFactoryName}/pipelines?api-version=2018-06-01`,
            serializationMapper: null,
            deserializationMapper: null,
        };
        let request = azureClient.sendRequest(options, async (err, result, request, response) => {
            if (err) {
                error(loc("TriggerAdfPipelines_GetPipelines", err.message));
                reject(loc("TriggerAdfPipelines_GetPipelines", err.message));
            } else if (response.statusCode !== 200) {
                debug(loc("TriggerAdfPipelines_GetPipelines2"));
                reject(loc("TriggerAdfPipelines_GetPipelines2"));
            } else {
                let objects = JSON.parse(JSON.stringify(result));
                let items = objects.value;
                let nextLink = objects.nextLink;
                while (nextLink !== undefined) {
                    let result = await processNextLink(datafactoryOption, nextLink);
                    objects = JSON.parse(JSON.stringify(result));
                    items = items.concat(objects.value);
                    nextLink = objects.nextLink;
                }
                items = items.filter((item) => {
                    return wildcardFilter(item.name, filter);
                });
                console.log(`Found ${items.length} pipeline(s).`);
                resolve(
                    items.map((value) => {
                        return { pipelineName: value.name, json: parameter };
                    })
                );
            }
        });
    });
}

function processNextLink(datafactoryOption: DatafactoryOptions, nextLink: string): Promise<any> {
    const azureClient: AzureServiceClient = datafactoryOption.azureClient,
        options: UrlBasedRequestPrepareOptions = {
            method: "GET",
            url: nextLink,
            serializationMapper: null,
            deserializationMapper: null,
        };
    debug(`Following next link`);
    return new Promise<any>((resolve, reject) => {
        azureClient.sendRequest(options, (err, result, request, response) => {
            resolve(result);
        });
    });
}

function triggerPipeline(
    datafactoryOption: DatafactoryOptions,
    deployOptions: DataFactoryDeployOptions,
    pipeline: DatafactoryPipelineObject
): Promise<DataFactoryRunResult> {
    return new Promise<DataFactoryRunResult>((resolve, reject) => {
        let azureClient: AzureServiceClient = datafactoryOption.azureClient,
            subscriptionId: string = datafactoryOption.subscriptionId,
            resourceGroup: string = datafactoryOption.resourceGroup,
            dataFactoryName: string = datafactoryOption.dataFactoryName;
        let pipelineName = pipeline.pipelineName;
        let options: UrlBasedRequestPrepareOptions = {
            method: "POST",
            url: `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DataFactory/factories/${dataFactoryName}/pipelines/${pipelineName}/createRun?api-version=2018-06-01`,
            serializationMapper: null,
            deserializationMapper: null,
            headers: {
                "Content-Type": "application/json",
            },
            body: pipeline.json,
            disableJsonStringifyOnBody: true,
        };
        let request = azureClient.sendRequest(options, (err, result: string, request, response) => {
            if (err) {
                if (deployOptions.continue) {
                    warning(loc("TriggerAdfPipelines_TriggerPipeline", pipelineName, err.message));
                    resolve();
                } else {
                    error(loc("TriggerAdfPipelines_TriggerPipeline", pipelineName, err.message));
                    reject(loc("TriggerAdfPipelines_TriggerPipeline", pipelineName, err.message));
                }
            } else if (response.statusCode !== 200 && response.statusCode !== 204) {
                if (deployOptions.continue) {
                    warning(loc("TriggerAdfPipelines_TriggerPipeline", pipelineName, JSON.stringify(result)));
                    resolve();
                } else {
                    error(loc("TriggerAdfPipelines_TriggerPipeline", pipelineName, JSON.stringify(result)));
                    reject(loc("TriggerAdfPipelines_TriggerPipeline", pipelineName, JSON.stringify(result)));
                }
            } else if (response.statusCode === 204) {
                warning(`'${pipelineName}' not found.`);
                resolve();
            } else {
                const runId = (result as any).runId;
                console.log(`Pipeline '${pipelineName}' triggered with run id: '${runId}'.`);
                resolve({
                    pipeline: pipelineName,
                    runId,
                });
            }
        });
    });
}

function triggerPipelines(
    datafactoryOption: DatafactoryOptions,
    deployOptions: DataFactoryDeployOptions,
    filter: string,
    parameter: string
): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
        getPipelines(datafactoryOption, filter, parameter)
            .then((pipelines: DatafactoryPipelineObject[]) => {
                processPipelines(datafactoryOption, deployOptions, pipelines)
                    .catch((err) => {
                        reject(err);
                    })
                    .then((result: boolean) => {
                        resolve(result);
                    });
            })
            .catch((err) => {
                debug(loc("TriggerAdfPipelines_TriggerPipelines", err.message));
                reject(loc("TriggerAdfPipelines_TriggerPipelines", err.message));
            });
    });
}

function processPipelines(
    datafactoryOption: DatafactoryOptions,
    deployOptions: DataFactoryDeployOptions,
    pipelines: DatafactoryPipelineObject[]
): Promise<boolean> {
    let firstError;
    return new Promise<boolean>((resolve, reject) => {
        let totalItems = pipelines.length;

        let process = all(
            pipelines.map(
                throat(deployOptions.throttle, (pipeline) => {
                    // console.log(`Trigger pipeline '${pipeline.pipelineName}'.`);
                    return triggerPipeline(datafactoryOption, deployOptions, pipeline);
                })
            )
        )
            .catch((err) => {
                hasError = true;
                firstError = firstError || err;
            })
            .done((results: any) => {
                debug(`${totalItems} pipeline(s) triggered.`);
                if (hasError) {
                    reject(firstError);
                } else {
                    if (isNonEmpty(deployOptions.deploymentOutputs)) {
                        setVariable(deployOptions.deploymentOutputs, JSON.stringify(results));
                        console.log(loc("TriggerAdfPipelines_AddedOutputVariable", deployOptions.deploymentOutputs));
                    }
                    let issues = results.filter((result) => {
                        return result === "";
                    }).length;
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
    let promise = new Promise<boolean>(async (resolve, reject) => {
        let taskParameters: TaskParameters;
        let azureModels: AzureModels;

        try {
            let debugMode: string = getVariable("System.Debug");
            let isVerbose: boolean = debugMode ? debugMode.toLowerCase() != "false" : false;

            debug("Task execution started ...");
            taskParameters = new TaskParameters();
            let connectedServiceName = taskParameters.ConnectedServiceName;
            let resourceGroup = taskParameters.ResourceGroupName;
            let dataFactoryName = taskParameters.DatafactoryName;

            let pipelineFilter = taskParameters.PipelineFilter;
            let pipelineParameter = taskParameters.PipelineParameter;

            switch (taskParameters.PipelineParameterType) {
                case PipelineParameterType.Inline:
                default:
                    pipelineParameter = taskParameters.PipelineParameter;
                    break;
                case PipelineParameterType.Path:
                    pipelineParameter = readFileSync(taskParameters.PipelineParameterPath, "utf8");
                    console.log(pipelineParameter);
                    break;
            }

            let deployOptions = {
                continue: taskParameters.Continue,
                throttle: taskParameters.Throttle,
                deploymentOutputs: taskParameters.DeploymentOutputs,
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
            debug("Parsed task inputs");

            loginAzure(clientId, key, tenantID)
                .then((azureClient: AzureServiceClient) => {
                    datafactoryOption.azureClient = azureClient;
                    debug("Azure client retrieved.");
                    return checkDataFactory(datafactoryOption);
                })
                .then((result) => {
                    debug(`Datafactory '${dataFactoryName}' exist`);
                    if (pipelineFilter !== null) {
                        triggerPipelines(datafactoryOption, deployOptions, pipelineFilter, pipelineParameter)
                            .then((result: boolean) => {
                                resolve(result);
                            })
                            .catch((err) => {
                                if (!deployOptions.continue) {
                                    debug("Cancelling trigger operation.");
                                    reject(err);
                                } else {
                                    resolve();
                                }
                            });
                    }
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

function isNonEmpty(str: string): boolean {
    return !!str && !!str.trim();
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
