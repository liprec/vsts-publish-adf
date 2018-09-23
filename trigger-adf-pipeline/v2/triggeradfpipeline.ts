/*
 * VSTS Trigger ADF Pipeline Task
 * 
 * Copyright (c) 2018 Jan Pieter Posthuma / DataScenarios
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

import Q = require('q');
import throat = require('throat');
import task = require('vsts-task-lib/task');
import path = require('path');
import msRestAzure = require('ms-rest-azure');
import { TaskParameters } from './models/taskParameters';
import { AzureModels } from './models/azureModels';

import AzureServiceClient = msRestAzure.AzureServiceClient;
import { UrlBasedRequestPrepareOptions } from './node_modules/ms-rest';

task.setResourcePath(path.join(__dirname, '../task.json'));

enum DatafactoryTypes {
    Pipeline = 'Pipeline',
    Dataset = 'Dataset',
    Trigger = 'Trigger',
    LinkedService = 'Linked Service'
}

interface DatafactoryOptions {
    azureClient?: AzureServiceClient,
    subscriptionId: string,
    resourceGroup: string,
    dataFactoryName: string
}

interface DataFactoryDeployOptions {
    continue: boolean,
    throttle: number
}

interface DatafactoryPipelineObject {
    pipelineName: string,
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
};

function checkDataFactory(datafactoryOption: DatafactoryOptions): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
        let azureClient: AzureServiceClient = datafactoryOption.azureClient,
            subscriptionId: string = datafactoryOption.subscriptionId,
            resourceGroup: string = datafactoryOption.resourceGroup,
            dataFactoryName: string = datafactoryOption.dataFactoryName;
        let options: UrlBasedRequestPrepareOptions = {
            method: 'GET',
            url: `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DataFactory/factories/${dataFactoryName}?api-version=2018-06-01`,
            serializationMapper: null,
            deserializationMapper: null
        }
        let request = azureClient.sendRequest(options, (err, result, request, response) => {
            if (err) {
                task.error(task.loc("Generic_CheckDataFactory", err));
                reject(task.loc("Generic_CheckDataFactory", err));
            }
            if (response.statusCode!==200) {
                task.debug(task.loc("Generic_CheckDataFactory2", dataFactoryName));
                reject(task.loc("Generic_CheckDataFactory2", dataFactoryName));
            } else {
                resolve(true);
            }
        })
    });
}

function getPipelines(datafactoryOption: DatafactoryOptions, filter: string): Promise<DatafactoryPipelineObject[]> {
    return new Promise<DatafactoryPipelineObject[]>((resolve, reject) => {
        let azureClient: AzureServiceClient = datafactoryOption.azureClient,
            subscriptionId: string = datafactoryOption.subscriptionId,
            resourceGroup: string = datafactoryOption.resourceGroup,
            dataFactoryName: string = datafactoryOption.dataFactoryName;
        let options: UrlBasedRequestPrepareOptions = {
            method: 'GET',
            url: `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DataFactory/factories/${dataFactoryName}/pipelines?api-version=2018-06-01`,
            serializationMapper: null,
            deserializationMapper: null
        };
        let request = azureClient.sendRequest(options, (err, result, request, response) => {
            if (err) {
                task.error(task.loc("TriggerAdfPipelines_GetPipelines", err.message));
                reject(task.loc("TriggerAdfPipelines_GetPipelines", err.message));
            } else if (response.statusCode!==200) {
                task.debug(task.loc("TriggerAdfPipelines_GetPipelines2"));
                reject(task.loc("TriggerAdfPipelines_GetPipelines2"));
            } else {
                let objects = JSON.parse(JSON.stringify(result));
                let items = objects.value;
                items = items.filter((item) => { return wildcardFilter(item.name, filter); })
                console.log(`Found ${items.length} pipeline(s).`);
                resolve(items.map((value) => { return { pipelineName: value.name }; }));
            }
        });
    });
}

function triggerPipeline(datafactoryOption: DatafactoryOptions, deployOptions: DataFactoryDeployOptions, pipeline: DatafactoryPipelineObject): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
        let azureClient: AzureServiceClient = datafactoryOption.azureClient,
            subscriptionId: string = datafactoryOption.subscriptionId,
            resourceGroup: string = datafactoryOption.resourceGroup,
            dataFactoryName: string = datafactoryOption.dataFactoryName;
        let pipelineName = pipeline.pipelineName;
        let options: UrlBasedRequestPrepareOptions = {
            method: 'POST',
            url: `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DataFactory/factories/${dataFactoryName}/pipelines/${pipelineName}/createRun?api-version=2018-06-01`,
            serializationMapper: null,
            deserializationMapper: null
        };
        let request = azureClient.sendRequest(options, (err, result, request, response) => {
            if (err) {
                task.error(task.loc("TriggerAdfPipelines_TriggerPipeline", pipelineName, err.message));
                reject(task.loc("TriggerAdfPipelines_TriggerPipeline", pipelineName, err.message));
            } else if ((response.statusCode!==200) && (response.statusCode!==204)) {
                resolve(false);
            } else if (response.statusCode===204) {
                task.debug(`'${pipelineName}' not found.`);
            } else {
                resolve(true);
            }
        });
    });
}

function triggerPipelines(datafactoryOption: DatafactoryOptions, deployOptions: DataFactoryDeployOptions, filter:string): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
        getPipelines(datafactoryOption, filter)
            .then((pipelines: DatafactoryPipelineObject[]) => {
                processPipelines(datafactoryOption, deployOptions, pipelines)
                    .catch((err) => {
                        reject(err);
                    })
                    .then(() => {
                        resolve(true);       
                    });
            })
            .catch((err) => {
                task.debug(task.loc("TriggerAdfPipelines_TriggerPipelines", err.message));
                reject(task.loc("TriggerAdfPipelines_TriggerPipelines", err.message));
            });
    });
}

function processPipelines(datafactoryOption: DatafactoryOptions, deployOptions: DataFactoryDeployOptions, pipelines: DatafactoryPipelineObject[]): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
        let totalItems = pipelines.length;

        let process = Q.all(pipelines.map(throat(deployOptions.throttle, (pipeline) => {
                console.log(`Trigger pipeline '${pipeline.pipelineName}'.`);
                return triggerPipeline(datafactoryOption, deployOptions, pipeline); 
            })))
            .catch((err) => {
                reject(err);
            })
            .done(() => { 
                task.debug(`${totalItems} pipeline(s) triggered.`);
                resolve(true);
            });
        });
}

async function main(): Promise<void> {
    let promise = new Promise<void>(async (resolve, reject) => {
        let taskParameters: TaskParameters;
        let azureModels: AzureModels;

        try {
            let debugMode: string = task.getVariable('System.Debug');
            let isVerbose: boolean = debugMode ? debugMode.toLowerCase() != 'false' : false;

            task.debug('Task execution started ...');
            taskParameters = new TaskParameters();
            let connectedServiceName = taskParameters.getConnectedServiceName();
            let resourceGroup = taskParameters.getResourceGroupName();
            let dataFactoryName = taskParameters.getDatafactoryName();

            let pipelineFilter = taskParameters.getPipelineFilter();
            
            let deployOptions = {
                continue: taskParameters.getContinue(),
                throttle: taskParameters.getThrottle()
            }
            
            azureModels = new AzureModels(connectedServiceName);
            let clientId = azureModels.getServicePrincipalClientId();
            let key = azureModels.getServicePrincipalKey();
            let tenantID = azureModels.getTenantId();
            let datafactoryOption: DatafactoryOptions = {
                subscriptionId: azureModels.getSubscriptionId(),
                resourceGroup: resourceGroup,
                dataFactoryName: dataFactoryName,
            };
            task.debug('Parsed task inputs');
            
            loginAzure(clientId, key, tenantID)
                .then((azureClient: AzureServiceClient) => {
                    datafactoryOption.azureClient = azureClient;
                    task.debug("Azure client retrieved.");
                    return checkDataFactory(datafactoryOption);
            }).then((result) => {
                task.debug(`Datafactory '${dataFactoryName}' exist`);
                if (pipelineFilter !== null) {
                    triggerPipelines(datafactoryOption, deployOptions, pipelineFilter)
                        .then(() => {
                            resolve();
                        }).catch((err) => {
                            if (!deployOptions.continue) {
                                task.debug('Cancelling trigger operation.');
                                reject(err);
                            } else {
                                resolve();
                            }
                        });
                }
            }).catch((err) => {
                reject(err.message);
            })
        }
        catch (exception) {
            reject(exception);
        }
    });
    return promise;
}

function wildcardFilter(value: string, rule: string) {
    return new RegExp("^" + rule.split("*").join(".*") + "$").test(value);
}

main()
    .then(() => {
        task.setResult(task.TaskResult.Succeeded, "");
    })
    .catch((err) => { 
        task.setResult(task.TaskResult.Failed, err); 
    });