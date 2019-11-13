/*
 * VSTS Delete ADF Items Task
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

import * as Q from 'q';
import throat from 'throat';
import * as task from 'azure-pipelines-task-lib/task';
import * as path from 'path';
import * as msRestAzure from 'ms-rest-azure';
import { TaskParameters, SortingDirection } from './models/taskParameters';
import { AzureModels } from './models/azureModels';

import AzureServiceClient = msRestAzure.AzureServiceClient;
import { UrlBasedRequestPrepareOptions } from './node_modules/ms-rest';

task.setResourcePath(path.join(__dirname, '../task.json'));

enum DatafactoryTypes {
    Pipeline = 'pipeline',
    Dataset = 'dataset',
    Trigger = 'trigger',
    LinkedService = 'linked service'
}

interface DatafactoryOptions {
    azureClient?: AzureServiceClient,
    subscriptionId: string,
    resourceGroup: string,
    dataFactoryName: string
}

interface DatafactoryTaskOptions {
    continue: boolean,
    throttle: number,
    sorting: SortingDirection,
}

interface DatafactoryObject {
    name: string,
    type: DatafactoryTypes
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

function getObjects(datafactoryOption: DatafactoryOptions, taskOptions: DatafactoryTaskOptions, datafactoryType: DatafactoryTypes, filter: string): Promise<DatafactoryObject[]> {
    return new Promise<DatafactoryObject[]>((resolve, reject) => {
        let azureClient: AzureServiceClient = datafactoryOption.azureClient,
            subscriptionId: string = datafactoryOption.subscriptionId,
            resourceGroup: string = datafactoryOption.resourceGroup,
            dataFactoryName: string = datafactoryOption.dataFactoryName;
        let objectType;
        switch (datafactoryType) {
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
            method: 'GET',
            url: `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DataFactory/factories/${dataFactoryName}/${objectType}?api-version=2018-06-01`,
            serializationMapper: null,
            deserializationMapper: null
        };
        let request = azureClient.sendRequest(options, (err, result, request, response) => {
            if (err) {
                task.error(task.loc("DeleteAdfItems_GetObjects", datafactoryType, err.message));
                reject(task.loc("DeleteAdfItems_GetObjects", datafactoryType, err.message));
            } else if (response.statusCode!==200) {
                task.debug(task.loc("DeleteAdfItems_GetObjects2", datafactoryType));
                reject(task.loc("DeleteAdfItems_GetObjects2", datafactoryType));
            } else {
                let objects = JSON.parse(JSON.stringify(result));
                let items = objects.value;
                items = items.filter((item) => { return wildcardFilter(item.name, filter); })
                taskOptions.sorting === SortingDirection.Ascending
                    ? items.sort((item1, item2) =>  <any>(item1.name > item2.name) - <any>(item1.name < item2.name))
                    : items.sort((item1, item2) =>  <any>(item2.name > item1.name) - <any>(item2.name < item1.name))
                console.log(`Found ${items.length} ${datafactoryType}(s).`);
                resolve(items.map((value) => { return { name: value.name, type: datafactoryType }; }));
            }
        });
    });
}

function deleteItem(datafactoryOption: DatafactoryOptions, taskOptions: DatafactoryTaskOptions, item: DatafactoryObject): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
        let azureClient: AzureServiceClient = datafactoryOption.azureClient,
            subscriptionId: string = datafactoryOption.subscriptionId,
            resourceGroup: string = datafactoryOption.resourceGroup,
            dataFactoryName: string = datafactoryOption.dataFactoryName;
        let objectName = item.name;
        let objectType;
        switch (item.type) {
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
            method: 'DELETE',
            url: `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DataFactory/factories/${dataFactoryName}/${objectType}/${objectName}?api-version=2018-06-01`,
            serializationMapper: null,
            deserializationMapper: null
        };
        let request = azureClient.sendRequest(options, (err, result, request, response) => {
            if ((err) && (!taskOptions.continue)) {
                task.error(task.loc("DeleteAdfItems_DeleteItem", item.type, err.message));
                reject(task.loc("DeleteAdfItems_DeleteItem", item.type, err.message));
            } else if (response.statusCode===400) {
                if (taskOptions.continue) {
                    task.warning(task.loc("DeleteAdfItems_DeleteItem2", item.name, item.type, JSON.stringify(result)));
                    resolve(false);
                } else {
                    task.error(task.loc("DeleteAdfItems_DeleteItem2", item.name, item.type, JSON.stringify(result)));
                    reject(task.loc("DeleteAdfItems_DeleteItem2", item.name, item.type, JSON.stringify(result)));
                }
            } else if (response.statusCode===204) {
                task.debug(`'${item.name}' not found.`);
                resolve(true);
            } else if (response.statusCode===200) {
                resolve(true);
            } else {
                resolve(false);
            }
        });
    });
}

function deleteItems(datafactoryOption: DatafactoryOptions, taskOptions: DatafactoryTaskOptions, filter:string, datafactoryType: DatafactoryTypes): Promise<boolean> {
    if (hasError) { return } // Some error occurred, so returning
    return new Promise<boolean>((resolve, reject) => {
        getObjects(datafactoryOption, taskOptions, datafactoryType, filter)
            .then((items: DatafactoryObject[]) => {
                processItems(datafactoryOption, taskOptions, datafactoryType, items)
                    .catch((err) => {
                        reject(err);
                    })
                    .then((result: boolean) => {
                        resolve(result);
                    });
            })
            .catch((err) => {
                task.debug(task.loc("DeleteAdfItems_DeleteItems", datafactoryType, err.message));
                reject(task.loc("DeleteAdfItems_DeleteItems", datafactoryType, err.message));
            });
    });
}

function processItems(datafactoryOption: DatafactoryOptions, taskOptions: DatafactoryTaskOptions, datafactoryType: DatafactoryTypes, items: DatafactoryObject[]): Promise<boolean> {
    let firstError; 
    return new Promise<boolean>((resolve, reject) => {
        let totalItems = items.length;

        let process = Q.all(items.map(throat(taskOptions.throttle, (item) => {
                console.log(`Delete ${datafactoryType} '${item.name}'.`);
                return deleteItem(datafactoryOption, taskOptions, item); 
            })))
            .catch((err) => {
                hasError = true;
                firstError = firstError || err;
            })
            .done((results: any) => {
                task.debug(`${totalItems} ${datafactoryType}(s) deleted.`); 
                if (hasError) {
                    reject(firstError);
                } else {
                    let issues = results.filter((result) => { return !result; }).length;
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
            let debugMode: string = task.getVariable('System.Debug');
            let isVerbose: boolean = debugMode ? debugMode.toLowerCase() != 'false' : false;

            task.debug('Task execution started ...');
            taskParameters = new TaskParameters();
            let connectedServiceName = taskParameters.ConnectedServiceName;
            let resourceGroup = taskParameters.ResourceGroupName;
            let dataFactoryName = taskParameters.DatafactoryName;

            let serviceFilter = taskParameters.ServiceFilter;
            let pipelineFilter = taskParameters.PipelineFilter;
            let datasetFilter = taskParameters.DatasetFilter;
            let triggerFilter = taskParameters.TriggerFilter;
            
            let taskOptions = {
                continue: taskParameters.Continue,
                throttle: taskParameters.Throttle,
                sorting: taskParameters.Sorting,
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
            let firstError;
            task.debug('Parsed task inputs');
            
            loginAzure(clientId, key, tenantID)
                .then((azureClient: AzureServiceClient) => {
                    datafactoryOption.azureClient = azureClient;
                    task.debug("Azure client retrieved.");
                    return checkDataFactory(datafactoryOption);
            }).then((result) => {
                task.debug(`Datafactory '${dataFactoryName}' exist`);
                let deleteTasks = [];
                if (triggerFilter !== null) {
                    deleteTasks.push({filter: triggerFilter, type: DatafactoryTypes.Trigger});
                }
                if (pipelineFilter !== null) {
                    deleteTasks.push({filter: pipelineFilter, type: DatafactoryTypes.Pipeline});
                }
                if (datasetFilter !== null) {
                    deleteTasks.push({filter: datasetFilter, type: DatafactoryTypes.Dataset});
                }
                if (serviceFilter !== null) {
                    deleteTasks.push({filter: serviceFilter, type: DatafactoryTypes.LinkedService});
                }
                Q.all(deleteTasks.map(throat(1, (task) => {
                        return deleteItems(datafactoryOption, taskOptions, task.filter, task.type);
                    })))
                    .catch((err) => {
                        hasError = true;
                        firstError = firstError || err;
                    })
                    .done((results: any) => {
                        if (hasError) {
                            reject(firstError);
                        } else {
                            let issues = results.filter((result) => { return !result; }).length;
                            if (issues > 0) {
                                resolve(false);
                            } else {
                                resolve(true);
                            }
                        }
                    });
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

// Set generic error flag
let hasError = false;

main()
    .then((result) => {
        task.setResult(result ? task.TaskResult.Succeeded : task.TaskResult.SucceededWithIssues, "");
    })
    .catch((err) => { 
        task.setResult(task.TaskResult.Failed, err); 
    });
