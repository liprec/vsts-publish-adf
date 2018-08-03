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

import Q = require('q');
import task = require('vsts-task-lib/task');
import path = require('path');
import msRestAzure = require('ms-rest-azure');
import https = require('https');
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

interface DatafactoryObject {
    name: string,
    type: DatafactoryTypes
}

function loginAzure(clientId: string, key: string, tenantID: string): Promise<AzureServiceClient> {
    return new Promise<AzureServiceClient>((resolve, reject) => {
        msRestAzure.loginWithServicePrincipalSecret(clientId, key, tenantID, (err, credentials) => {
            if (err) {
                task.error(task.loc("DeleteAdfItems_LoginAzure", err.message));
                reject(task.loc("DeleteAdfItems_LoginAzure", err.message));
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
            url: `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DataFactory/factories/${dataFactoryName}?api-version=2017-09-01-preview`,
            serializationMapper: null,
            deserializationMapper: null
        }
        let request = azureClient.sendRequest(options, (err, result, request, response) => {
            if (err) {
                task.error(task.loc("DeleteAdfItems_CheckDataFactory", err));
                reject(task.loc("DeleteAdfItems_CheckDataFactory", err));
            }
            if (response.statusCode!==200) {
                task.debug(task.loc("DeleteAdfItems_CheckDataFactory2", dataFactoryName));
                reject(task.loc("DeleteAdfItems_CheckDataFactory2", dataFactoryName));
            } else {
                resolve(true);
            }
        })
    });
}

function getObjects(datafactoryOption: DatafactoryOptions, datafactoryType: DatafactoryTypes, filter: string): Promise<DatafactoryObject[]> {
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
            url: `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DataFactory/factories/${dataFactoryName}/${objectType}?api-version=2017-09-01-preview`,
            serializationMapper: null,
            deserializationMapper: null
        };
        let request = azureClient.sendRequest(options, (err, result, request, response) => {
            if (err) {
                task.error(task.loc("DeleteAdfItems_GetObjects", datafactoryType, err.message));
                reject(task.loc("DeleteAdfItems_GetObjects", datafactoryType, err.message));
            }
            if (response.statusCode!==200) {
                task.debug(task.loc("DeleteAdfItems_GetObjects2", datafactoryType));
                reject(task.loc("DeleteAdfItems_GetObjects2", datafactoryType));
            }
            let objects = JSON.parse(JSON.stringify(result));
            let items = objects.value;
            items = items.filter((item) => { return wildcardFilter(item.name, filter); })
            console.log(`Found ${items.length} ${datafactoryType}(s).`);
            resolve(items.map((value) => { return { name: value.name, type: datafactoryType }; }));
        });
    });
}

function deleteItem(datafactoryOption: DatafactoryOptions, item: DatafactoryObject): Promise<boolean> {
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
            url: `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DataFactory/factories/${dataFactoryName}/${objectType}/${objectName}?api-version=2017-09-01-preview`,
            serializationMapper: null,
            deserializationMapper: null
        };
        let request = azureClient.sendRequest(options, (err, result, request, response) => {
            if (err) {
                task.error(task.loc("DeleteAdfItems_DeleteItem", item.type, err.message));
                reject(task.loc("DeleteAdfItems_DeleteItem", item.type, err.message));
            }
            if ((response.statusCode!==200) && (response.statusCode!==204)) {
                resolve(false);
            }
            if (response.statusCode===204) {
                task.debug(`'${item.name}' not found.`);
            }
            resolve(true);
        });
    });
}

function deleteItems(datafactoryOption: DatafactoryOptions, filter:string, datafactoryType: DatafactoryTypes): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
        getObjects(datafactoryOption, datafactoryType, filter)
            .then((items: DatafactoryObject[]) => {
                processItems(datafactoryOption, datafactoryType, items);
                resolve(true);
                return
            })
            .catch((err) => {
                task.debug(task.loc("DeleteAdfItems_DeleteItems", datafactoryType, err.message));
                reject(task.loc("DeleteAdfItems_DeleteItems", datafactoryType, err.message))
                return
            });
    });
}

function processItems(datafactoryOption: DatafactoryOptions, datafactoryType: DatafactoryTypes, items: DatafactoryObject[], throttle: number = 5) {
    let queue = [];
    let counter = 0;
    let totalItems = items.length;

    if (totalItems===0) { return }

    let addToQueue = function(data) {
        let deferred = Q.defer();
        queue.push({data: data, promise: deferred});
        processQueue();
        return(deferred.promise);
    }
    
    let processQueue = function() {
        if(queue.length > 0 && counter < throttle) {
            counter++;
            let item = queue.shift();
            console.log(`Delete ${datafactoryType} '${item.data.name}'.`);
            deleteItem(datafactoryOption, item.data)
                .then((result) => {
                    if (!result) {
                        task.debug('Retry deleting.');
                        deleteItem(datafactoryOption, item.data);
                    }
                })
                .catch((err) => {
                    item.promise.reject(err.message);
                });
            item.promise.resolve();
            counter--;
            if(queue.length > 0 && counter < throttle) {
                task.debug(`Processing next ${datafactoryType} in queue.`);
                processQueue(); // on to next item in queue
            }
        }
    }

    task.debug(`Processing ${totalItems} ${datafactoryType}(s) with ${throttle} queues.`);
    Q.all(items.map(addToQueue))
        .catch((err) => { task.error(err); })
        .done(() => { task.debug(`${totalItems} ${datafactoryType}(s) deleted.`); })
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

            let serviceFilter = taskParameters.getServiceFilter();
            let pipelineFilter = taskParameters.getPipelineFilter();
            let datasetFilter = taskParameters.getDatasetFilter();
            let triggerFilter = taskParameters.getTriggerFilter();
            
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
                if (triggerFilter !== null) {
                    deleteItems(datafactoryOption, triggerFilter, DatafactoryTypes.Trigger);
                }
                if (pipelineFilter !== null) {
                    deleteItems(datafactoryOption, pipelineFilter, DatafactoryTypes.Pipeline);
                    }
                if (datasetFilter !== null) {
                    deleteItems(datafactoryOption, datasetFilter, DatafactoryTypes.Dataset);
                }
                if (serviceFilter !== null) {
                    deleteItems(datafactoryOption, serviceFilter, DatafactoryTypes.LinkedService);
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
    .then((result) => { task.setResult(task.TaskResult.Succeeded, ""); })
    .catch((err) => { task.setResult(task.TaskResult.Failed, err); });