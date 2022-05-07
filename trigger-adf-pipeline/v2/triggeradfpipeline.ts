/*
 * Azure Pipelines Azure Data Factory Trigger Pipeline Task
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

"use strict";

import throat from "throat";
import {
    error,
    warning,
    debug,
    loc,
    setResourcePath,
    setVariable,
    setResult,
    TaskResult,
} from "azure-pipelines-task-lib/task";
import { join } from "path";
import { readFileSync } from "fs";
import { AccessToken, ClientSecretCredential } from "@azure/identity";
import { AzureServiceClient } from "@azure/ms-rest-azure-js";
import { HttpOperationResponse, RequestPrepareOptions, TokenCredentials } from "@azure/ms-rest-js";

import {
    DataFactoryDeployOptions,
    DatafactoryOptions,
    DatafactoryPipelineObject,
    DataFactoryRunResult,
} from "./lib/interfaces";
import { TaskParameters, PipelineParameterType } from "./models/taskParameters";
import { AzureModels } from "./models/azureModels";
import { wildcardFilter } from "./lib/helpers";

setResourcePath(join(__dirname, "../task.json"));

type pipelineTriggerJson = {
    name: string;
};

function loginAzure(
    clientId: string,
    key: string,
    tenantID: string,
    authorityHostUrl: string,
    scheme: string,
    audience: string
): Promise<AzureServiceClient> {
    return new Promise<AzureServiceClient>((resolve, reject) => {
        if (scheme.toLocaleLowerCase() === "managedserviceidentity") {
            // loginWithAppServiceMSI()
            //     .then((credentials: MSIAppServiceTokenCredentials) => {
            //         resolve(new AzureServiceClient(credentials, {}));
            //     })
            //     .catch((err: Error) => {
            //         if (err) {
            //             error(loc("Generic_LoginAzure", err.message));
            //             reject(loc("Generic_LoginAzure", err.message));
            //         }
            //     });
        } else {
            const credential = new ClientSecretCredential(tenantID, clientId, key, {
                authorityHost: authorityHostUrl,
            });
            credential
                .getToken(audience)
                .then((accessToken: AccessToken) => {
                    const token = new TokenCredentials(accessToken.token);
                    resolve(new AzureServiceClient(token));
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

function getPipelines(
    datafactoryOption: DatafactoryOptions,
    filter: string,
    parameter: string
): Promise<DatafactoryPipelineObject[]> {
    return new Promise<DatafactoryPipelineObject[]>((resolve, reject) => {
        const azureClient: AzureServiceClient = datafactoryOption.azureClient as AzureServiceClient,
            environmentUrl: string = datafactoryOption.environmentUrl,
            subscriptionId: string = datafactoryOption.subscriptionId,
            workspaceUrl: string | undefined = datafactoryOption.workspaceUrl,
            resourceGroup: string | undefined = datafactoryOption.resourceGroup,
            dataFactoryName: string | undefined = datafactoryOption.dataFactoryName;
        const endPoint = workspaceUrl
            ? `https://${workspaceUrl}`
            : `https://${environmentUrl}/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DataFactory/factories/${dataFactoryName}`;
        const apiVersion = workspaceUrl ? "2020-12-01" : "2018-06-01";
        const options: RequestPrepareOptions = {
            method: "GET",
            url: `${endPoint}/pipelines?api-version=${apiVersion}`,
        };
        azureClient
            .sendRequest(options)
            .then(async (result: HttpOperationResponse) => {
                if (result && result.status !== 200) {
                    error(loc("TriggerAdfPipelines_GetPipelines", result.bodyAsText));
                    reject(loc("TriggerAdfPipelines_GetPipelines", result.bodyAsText));
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
                    items = items.filter((item: pipelineTriggerJson) => {
                        return wildcardFilter(item.name, filter);
                    });
                    console.log(`Found ${items.length} pipeline(s).`);
                    resolve(
                        items.map((item: pipelineTriggerJson) => {
                            return { pipelineName: item.name, json: parameter };
                        })
                    );
                }
            })
            .catch((err: Error) => {
                if (err) {
                    error(loc("TriggerAdfPipelines_GetPipelines", err));
                    reject(loc("TriggerAdfPipelines_GetPipelines", err));
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

function triggerPipeline(
    datafactoryOption: DatafactoryOptions,
    deployOptions: DataFactoryDeployOptions,
    pipeline: DatafactoryPipelineObject
): Promise<DataFactoryRunResult> {
    return new Promise<DataFactoryRunResult>((resolve, reject) => {
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
        const pipelineName = pipeline.pipelineName;
        const options: RequestPrepareOptions = {
            method: "POST",
            url: `${endPoint}/pipelines/${pipelineName}/createRun?api-version=${apiVersion}`,
            headers: {
                "Content-Type": "application/json",
            },
            body: pipeline.json,
            disableJsonStringifyOnBody: true,
        };
        azureClient
            .sendRequest(options)
            .then((result: HttpOperationResponse) => {
                const objects = JSON.parse(JSON.stringify(result.parsedBody));
                if (result && result.status !== 200 && result.status !== 202 && result.status !== 204) {
                    const cloudError = objects.error;
                    if (deployOptions.continue) {
                        warning(loc("TriggerAdfPipelines_TriggerPipeline", pipelineName, cloudError.message));
                        resolve(undefined);
                    } else {
                        error(loc("TriggerAdfPipelines_TriggerPipeline", pipelineName, cloudError.message));
                        reject(loc("TriggerAdfPipelines_TriggerPipeline", pipelineName, cloudError.message));
                    }
                } else if (result && result.status === 204) {
                    warning(`'${pipelineName}' not found.`);
                    resolve(undefined);
                } else {
                    const runId = objects.runId;
                    console.log(`Pipeline '${pipelineName}' triggered with run id: '${runId}'.`);
                    resolve({
                        pipeline: pipelineName,
                        runId,
                    });
                }
            })
            .catch((err: Error) => {
                if (err) {
                    if (deployOptions.continue) {
                        warning(loc("TriggerAdfPipelines_TriggerPipeline", pipelineName, err.message));
                        resolve(undefined);
                    } else {
                        error(loc("TriggerAdfPipelines_TriggerPipeline", pipelineName, err.message));
                        reject(loc("TriggerAdfPipelines_TriggerPipeline", pipelineName, err.message));
                    }
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
                    .then((result: boolean | void) => {
                        resolve(result as boolean);
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
    let firstError: boolean;
    return new Promise<boolean>((resolve, reject) => {
        const totalItems = pipelines.length;

        Promise.all(
            pipelines.map(
                throat(deployOptions.throttle, (pipeline) => {
                    return triggerPipeline(datafactoryOption, deployOptions, pipeline);
                })
            )
        )
            .catch((err) => {
                hasError = true;
                firstError = firstError || err;
            })
            .then((results: void | DataFactoryRunResult[]) => {
                debug(`${totalItems} pipeline(s) triggered.`);
                if (hasError) {
                    reject(firstError);
                } else {
                    if (isNonEmpty(deployOptions.deploymentOutputs)) {
                        setVariable(
                            deployOptions.deploymentOutputs,
                            JSON.stringify(
                                (results as DataFactoryRunResult[]).filter((result: DataFactoryRunResult) => !!result)
                            )
                        );
                        console.log(loc("TriggerAdfPipelines_AddedOutputVariable", deployOptions.deploymentOutputs));
                    }
                    const issues = (results as DataFactoryRunResult[]).filter((result: DataFactoryRunResult) => {
                        return result === undefined;
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
    const promise = new Promise<boolean>((resolve, reject) => {
        let taskParameters: TaskParameters;
        let azureModels: AzureModels;

        try {
            // const debugMode: string = getVariable("System.Debug") as string;
            // const isVerbose: boolean = debugMode ? debugMode.toLowerCase() != "false" : false;

            debug("Task execution started ...");
            taskParameters = new TaskParameters();
            const connectedServiceName = taskParameters.ConnectedServiceName;
            const workspaceUrl = taskParameters.WorkspaceUrl;
            const resourceGroup = taskParameters.ResourceGroupName;
            const dataFactoryName = taskParameters.DatafactoryName;

            const pipelineFilter = taskParameters.PipelineFilter;
            let pipelineParameter = taskParameters.PipelineParameter;

            switch (taskParameters.PipelineParameterType) {
                case PipelineParameterType.Inline:
                default:
                    pipelineParameter = taskParameters.PipelineParameter;
                    break;
                case PipelineParameterType.Path:
                    pipelineParameter = readFileSync(taskParameters.PipelineParameterPath as string, "utf8");
                    console.log(pipelineParameter);
                    break;
            }

            const deployOptions = {
                continue: taskParameters.Continue,
                throttle: taskParameters.Throttle,
                deploymentOutputs: taskParameters.DeploymentOutputs,
            };

            azureModels = new AzureModels(connectedServiceName);
            const clientId = azureModels.ServicePrincipalClientId;
            const key = azureModels.ServicePrincipalKey;
            const tenantID = azureModels.TenantId;
            const authorityHostUrl = azureModels.EnvironmentAuthorityUrl;
            const datafactoryOption: DatafactoryOptions = {
                subscriptionId: azureModels.SubscriptionId,
                environmentUrl: azureModels.EnvironmentUrl,
                workspaceUrl: workspaceUrl,
                resourceGroup: resourceGroup,
                dataFactoryName: dataFactoryName,
            };
            const scheme = azureModels.AuthScheme;
            debug("Parsed task inputs");

            loginAzure(clientId, key, tenantID, authorityHostUrl, scheme, taskParameters.Audience)
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
                                    resolve(true);
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
