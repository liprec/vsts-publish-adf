/*
 * Azure Pipelines Azure Datafactory Trigger Task
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
import { error, warning, loc, setResourcePath, debug, TaskResult, setResult } from "azure-pipelines-task-lib/task";
import { join } from "path";
import { AccessToken, ClientSecretCredential } from "@azure/identity";
import { AzureServiceClient } from "@azure/ms-rest-azure-js";
import { HttpOperationResponse, RequestPrepareOptions, TokenCredentials } from "@azure/ms-rest-js";

import { DatafactoryToggle } from "./lib/enums";
import { DataFactoryDeployOptions, DatafactoryOptions, DatafactoryTriggerObject } from "./lib/interfaces";
import { TaskParameters } from "./models/taskParameters";
import { AzureModels } from "./models/azureModels";
import { wildcardFilter } from "./lib/helpers";

setResourcePath(join(__dirname, "../task.json"));

type triggerJson = {
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
                    debug(`Error: ${result && result.bodyAsText}`);
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

function getTriggers(
    datafactoryOption: DatafactoryOptions,
    deployOptions: DataFactoryDeployOptions,
    triggerFilter: string,
    toggle: DatafactoryToggle
): Promise<DatafactoryTriggerObject[]> {
    return new Promise<DatafactoryTriggerObject[]>((resolve, reject) => {
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
            url: `${endPoint}/triggers?api-version=${apiVersion}`,
        };
        azureClient
            .sendRequest(options)
            .then(async (result: HttpOperationResponse) => {
                if (result && result.status !== 200) {
                    error(loc("ToggleAdfTrigger_GetTriggers", result.bodyAsText));
                    reject(loc("ToggleAdfTrigger_GetTriggers", result.bodyAsText));
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
                    items = items.filter((item: triggerJson) => {
                        return wildcardFilter(item.name, triggerFilter);
                    });
                    console.log(`Found ${items.length} trigger(s).`);
                    resolve(
                        items.map((item: triggerJson) => {
                            return { triggerName: item.name, toggle: toggle };
                        })
                    );
                }
            })
            .catch((err: Error) => {
                if (err) {
                    error(loc("ToggleAdfTrigger_GetTriggers", err));
                    reject(loc("ToggleAdfTrigger_GetTriggers", err));
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

function toggleTrigger(
    datafactoryOption: DatafactoryOptions,
    deployOptions: DataFactoryDeployOptions,
    trigger: DatafactoryTriggerObject
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
        const triggerName = trigger.triggerName;
        const triggerAction = trigger.toggle;
        const options: RequestPrepareOptions = {
            method: "POST",
            url: `${endPoint}/triggers/${triggerName}/${triggerAction}?api-version=${apiVersion}`,
            headers: {
                "Content-Type": "application/json",
            },
        };
        azureClient
            .sendRequest(options)
            .then((result: HttpOperationResponse) => {
                if (result && result.status !== 200) {
                    if (deployOptions.continue) {
                        warning(
                            loc(
                                "ToggleAdfTrigger_ToggleTrigger2",
                                trigger.triggerName,
                                trigger.toggle.toString(),
                                JSON.stringify(result)
                            )
                        );
                        resolve(false);
                    } else {
                        reject(
                            loc(
                                "ToggleAdfTrigger_ToggleTrigger2",
                                trigger.triggerName,
                                trigger.toggle.toString(),
                                JSON.stringify(result)
                            )
                        );
                    }
                } else {
                    resolve(true);
                }
            })
            .catch((err: Error) => {
                if (err && !deployOptions.continue) {
                    error(
                        loc(
                            "ToggleAdfTrigger_ToggleTrigger2",
                            trigger.triggerName,
                            trigger.toggle.toString(),
                            err.message
                        )
                    );
                    reject(
                        loc(
                            "ToggleAdfTrigger_ToggleTrigger2",
                            trigger.triggerName,
                            trigger.toggle.toString(),
                            err.message
                        )
                    );
                }
            });
    });
}

function toggleTriggers(
    datafactoryOption: DatafactoryOptions,
    deployOptions: DataFactoryDeployOptions,
    triggerFilter: string,
    toggle: DatafactoryToggle
): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
        getTriggers(datafactoryOption, deployOptions, triggerFilter, toggle)
            .then((triggers: DatafactoryTriggerObject[]) => {
                processItems(datafactoryOption, deployOptions, triggers)
                    .catch((err) => {
                        reject(err);
                    })
                    .then((result: boolean | void) => {
                        resolve(result as boolean);
                    });
            })
            .catch((err) => {
                debug(loc("ToggleAdfTrigger_ToggleTrigger", toggle, err.message));
                reject(loc("ToggleAdfTrigger_ToggleTrigger", toggle, err.message));
            });
    });
}

function processItems(
    datafactoryOption: DatafactoryOptions,
    deployOptions: DataFactoryDeployOptions,
    triggers: DatafactoryTriggerObject[]
) {
    let firstError: boolean;
    return new Promise<boolean>((resolve, reject) => {
        const totalItems = triggers.length;

        Promise.all(
            triggers.map(
                throat(deployOptions.throttle, (trigger) => {
                    console.log(`Toggle '${trigger.triggerName}' to '${trigger.toggle}'.`);
                    return toggleTrigger(datafactoryOption, deployOptions, trigger);
                })
            )
        )
            .catch((err) => {
                hasError = true;
                firstError = firstError || err;
            })
            .then((results: boolean[] | void) => {
                debug(`${totalItems} trigger(s) toggled.`);
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
    });
}

async function main(): Promise<boolean> {
    const promise = new Promise<boolean>((resolve, reject) => {
        let taskParameters: TaskParameters;
        let azureModels: AzureModels;

        try {
            // const debugMode: string = <string>getVariable("System.Debug");
            // const isVerbose: boolean = debugMode ? debugMode.toLowerCase() != "false" : false;

            debug("Task execution started ...");
            taskParameters = new TaskParameters();
            const connectedServiceName = taskParameters.ConnectedServiceName;
            const workspaceUrl = taskParameters.WorkspaceUrl;
            const resourceGroup = taskParameters.ResourceGroupName;
            const dataFactoryName = taskParameters.DatafactoryName;

            const triggerFilter = taskParameters.TriggerFilter;
            const triggerStatus = taskParameters.TriggerStatus;

            const deployOptions = {
                continue: taskParameters.Continue,
                throttle: taskParameters.Throttle,
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

            loginAzure(
                clientId,
                key,
                tenantID,
                authorityHostUrl,
                scheme,
                taskParameters.Audience || azureModels.Audience
            )
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
                    // Toggle Trigger logic
                    toggleTriggers(datafactoryOption, deployOptions, triggerFilter, triggerStatus)
                        .then((result: boolean) => {
                            resolve(result);
                        })
                        .catch((err) => {
                            if (!deployOptions.continue) {
                                debug("Cancelling toggle operation.");
                                reject(err);
                            } else {
                                resolve(true);
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
