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

import { DatafactoryToggle } from "./lib/enums";
import { DataFactoryDeployOptions, DatafactoryOptions, DatafactoryTriggerObject } from "./lib/interfaces";
import { TaskParameters } from "./models/taskParameters";
import { AzureModels } from "./models/azureModels";

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

function getTriggers(
    datafactoryOption: DatafactoryOptions,
    deployOptions: DataFactoryDeployOptions,
    triggerFilter: string,
    toggle: DatafactoryToggle
): Promise<DatafactoryTriggerObject[]> {
    return new Promise<DatafactoryTriggerObject[]>((resolve, reject) => {
        const azureClient: AzureServiceClient = <AzureServiceClient>datafactoryOption.azureClient,
            subscriptionId: string = datafactoryOption.subscriptionId,
            resourceGroup: string = datafactoryOption.resourceGroup,
            dataFactoryName: string = datafactoryOption.dataFactoryName;
        const options: UrlBasedRequestPrepareOptions = {
            method: "GET",
            url: `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DataFactory/factories/${dataFactoryName}/triggers?api-version=2018-06-01`,
            serializationMapper: <Mapper>(<unknown>undefined),
            deserializationMapper: <Mapper>(<unknown>undefined),
        };
        const request = azureClient.sendRequest(options, async (err, result, request, response) => {
            if (err) {
                error(loc("ToggleAdfTrigger_GetTriggers", err.message));
                reject(loc("ToggleAdfTrigger_GetTriggers", err.message));
            } else if (response && response.statusCode !== 200) {
                debug(loc("ToggleAdfTrigger_GetTriggers2"));
                reject(loc("ToggleAdfTrigger_GetTriggers2"));
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
                items = items.filter((item: any) => {
                    return wildcardFilter(item.name, triggerFilter);
                });
                console.log(`Found ${items.length} trigger(s).`);
                resolve(
                    items.map((item: any) => {
                        return { triggerName: item.name, toggle: toggle };
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

function toggleTrigger(
    datafactoryOption: DatafactoryOptions,
    deployOptions: DataFactoryDeployOptions,
    trigger: DatafactoryTriggerObject
): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
        const azureClient: AzureServiceClient = <AzureServiceClient>datafactoryOption.azureClient,
            subscriptionId: string = datafactoryOption.subscriptionId,
            resourceGroup: string = datafactoryOption.resourceGroup,
            dataFactoryName: string = datafactoryOption.dataFactoryName;
        const triggerName = trigger.triggerName;
        const triggerAction = trigger.toggle;
        const options: UrlBasedRequestPrepareOptions = {
            method: "POST",
            url: `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DataFactory/factories/${dataFactoryName}/triggers/${triggerName}/${triggerAction}?api-version=2018-06-01`,
            serializationMapper: <Mapper>(<unknown>undefined),
            deserializationMapper: <Mapper>(<unknown>undefined),
            headers: {
                "Content-Type": "application/json",
            },
        };
        const request = azureClient.sendRequest(options, (err, result, request, response) => {
            if (err && !deployOptions.continue) {
                error(
                    loc("ToggleAdfTrigger_ToggleTrigger2", trigger.triggerName, trigger.toggle.toString(), err.message)
                );
                reject(
                    loc("ToggleAdfTrigger_ToggleTrigger2", trigger.triggerName, trigger.toggle.toString(), err.message)
                );
            } else if (response && response.statusCode !== 200) {
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
                        resolve(<boolean>result);
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

        const process = Promise.all(
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
            const connectedServiceName = taskParameters.getConnectedServiceName();
            const resourceGroup = taskParameters.getResourceGroupName();
            const dataFactoryName = taskParameters.getDatafactoryName();

            const triggerFilter = taskParameters.getTriggerFilter();
            const triggerStatus = taskParameters.getTriggerStatus();

            const deployOptions = {
                continue: taskParameters.getContinue(),
                throttle: taskParameters.getThrottle(),
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
                    // Toggle Trigger logic
                    if (triggerFilter) {
                        toggleTriggers(datafactoryOption, deployOptions, triggerFilter, triggerStatus)
                            .then((result: boolean) => {
                                resolve(result);
                            })
                            .catch((err) => {
                                if (!deployOptions.continue) {
                                    debug("Cancelling toggle operation.");
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

// Set generic error flag
let hasError = false;

main()
    .then((result) => {
        setResult(result ? TaskResult.Succeeded : TaskResult.SucceededWithIssues, "");
    })
    .catch((err) => {
        setResult(TaskResult.Failed, err);
    });
