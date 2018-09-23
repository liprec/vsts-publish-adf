"use strict";
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const Q = require("q");
const throat = require("throat");
const task = require("vsts-task-lib/task");
const path = require("path");
const msRestAzure = require("ms-rest-azure");
const taskParameters_1 = require("./models/taskParameters");
const azureModels_1 = require("./models/azureModels");
var AzureServiceClient = msRestAzure.AzureServiceClient;
task.setResourcePath(path.join(__dirname, '../task.json'));
var DatafactoryTypes;
(function (DatafactoryTypes) {
    DatafactoryTypes["Pipeline"] = "pipeline";
    DatafactoryTypes["Dataset"] = "dataset";
    DatafactoryTypes["Trigger"] = "trigger";
    DatafactoryTypes["LinkedService"] = "linked service";
})(DatafactoryTypes || (DatafactoryTypes = {}));
function loginAzure(clientId, key, tenantID) {
    return new Promise((resolve, reject) => {
        msRestAzure.loginWithServicePrincipalSecret(clientId, key, tenantID, (err, credentials) => {
            if (err) {
                task.error(task.loc("Generic_LoginAzure", err.message));
                reject(task.loc("Generic_LoginAzure", err.message));
            }
            resolve(new AzureServiceClient(credentials, {}));
        });
    });
}
;
function checkDataFactory(datafactoryOption) {
    return new Promise((resolve, reject) => {
        let azureClient = datafactoryOption.azureClient, subscriptionId = datafactoryOption.subscriptionId, resourceGroup = datafactoryOption.resourceGroup, dataFactoryName = datafactoryOption.dataFactoryName;
        let options = {
            method: 'GET',
            url: `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DataFactory/factories/${dataFactoryName}?api-version=2018-06-01`,
            serializationMapper: null,
            deserializationMapper: null
        };
        let request = azureClient.sendRequest(options, (err, result, request, response) => {
            if (err) {
                task.error(task.loc("Generic_CheckDataFactory", err));
                reject(task.loc("Generic_CheckDataFactory", err));
            }
            if (response.statusCode !== 200) {
                task.debug(task.loc("Generic_CheckDataFactory2", dataFactoryName));
                reject(task.loc("Generic_CheckDataFactory2", dataFactoryName));
            }
            else {
                resolve(true);
            }
        });
    });
}
function getObjects(datafactoryOption, datafactoryType, filter) {
    return new Promise((resolve, reject) => {
        let azureClient = datafactoryOption.azureClient, subscriptionId = datafactoryOption.subscriptionId, resourceGroup = datafactoryOption.resourceGroup, dataFactoryName = datafactoryOption.dataFactoryName;
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
        let options = {
            method: 'GET',
            url: `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DataFactory/factories/${dataFactoryName}/${objectType}?api-version=2018-06-01`,
            serializationMapper: null,
            deserializationMapper: null
        };
        let request = azureClient.sendRequest(options, (err, result, request, response) => {
            if (err) {
                task.error(task.loc("DeleteAdfItems_GetObjects", datafactoryType, err.message));
                reject(task.loc("DeleteAdfItems_GetObjects", datafactoryType, err.message));
            }
            else if (response.statusCode !== 200) {
                task.debug(task.loc("DeleteAdfItems_GetObjects2", datafactoryType));
                reject(task.loc("DeleteAdfItems_GetObjects2", datafactoryType));
            }
            else {
                let objects = JSON.parse(JSON.stringify(result));
                let items = objects.value;
                items = items.filter((item) => { return wildcardFilter(item.name, filter); });
                console.log(`Found ${items.length} ${datafactoryType}(s).`);
                resolve(items.map((value) => { return { name: value.name, type: datafactoryType }; }));
            }
        });
    });
}
function deleteItem(datafactoryOption, deployOptions, item) {
    return new Promise((resolve, reject) => {
        let azureClient = datafactoryOption.azureClient, subscriptionId = datafactoryOption.subscriptionId, resourceGroup = datafactoryOption.resourceGroup, dataFactoryName = datafactoryOption.dataFactoryName;
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
        let options = {
            method: 'DELETE',
            url: `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DataFactory/factories/${dataFactoryName}/${objectType}/${objectName}?api-version=2018-06-01`,
            serializationMapper: null,
            deserializationMapper: null
        };
        let request = azureClient.sendRequest(options, (err, result, request, response) => {
            if ((err) && (!deployOptions.continue)) {
                task.error(task.loc("DeleteAdfItems_DeleteItem", item.type, err.message));
                reject(task.loc("DeleteAdfItems_DeleteItem", item.type, err.message));
            }
            else if (response.statusCode === 400) {
                if (deployOptions.continue) {
                    task.warning(task.loc("DeleteAdfItems_DeleteItem2", item.name, item.type, JSON.stringify(result)));
                    resolve(false);
                }
                else {
                    task.error(task.loc("DeleteAdfItems_DeleteItem2", item.name, item.type, JSON.stringify(result)));
                    reject(task.loc("DeleteAdfItems_DeleteItem2", item.name, item.type, JSON.stringify(result)));
                }
            }
            else if (response.statusCode === 204) {
                task.debug(`'${item.name}' not found.`);
                resolve(true);
            }
            else if (response.statusCode === 200) {
                resolve(true);
            }
            else {
                resolve(false);
            }
        });
    });
}
function deleteItems(datafactoryOption, filter, deployOptions, datafactoryType) {
    return new Promise((resolve, reject) => {
        getObjects(datafactoryOption, datafactoryType, filter)
            .then((items) => {
            processItems(datafactoryOption, deployOptions, datafactoryType, items)
                .catch((err) => {
                reject(err);
            })
                .then(() => {
                resolve(true);
            });
        })
            .catch((err) => {
            task.debug(task.loc("DeleteAdfItems_DeleteItems", datafactoryType, err.message));
            reject(task.loc("DeleteAdfItems_DeleteItems", datafactoryType, err.message));
        });
    });
}
function processItems(datafactoryOption, deployOptions, datafactoryType, items) {
    return new Promise((resolve, reject) => {
        let totalItems = items.length;
        let process = Q.all(items.map(throat(deployOptions.throttle, (item) => {
            console.log(`Delete ${datafactoryType} '${item.name}'.`);
            return deleteItem(datafactoryOption, deployOptions, item);
        })))
            .catch((err) => {
            reject(err);
        })
            .done(() => {
            task.debug(`${totalItems} ${datafactoryType}(s) deleted.`);
            resolve(true);
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        let promise = new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            let taskParameters;
            let azureModels;
            try {
                let debugMode = task.getVariable('System.Debug');
                let isVerbose = debugMode ? debugMode.toLowerCase() != 'false' : false;
                task.debug('Task execution started ...');
                taskParameters = new taskParameters_1.TaskParameters();
                let connectedServiceName = taskParameters.getConnectedServiceName();
                let resourceGroup = taskParameters.getResourceGroupName();
                let dataFactoryName = taskParameters.getDatafactoryName();
                let serviceFilter = taskParameters.getServiceFilter();
                let pipelineFilter = taskParameters.getPipelineFilter();
                let datasetFilter = taskParameters.getDatasetFilter();
                let triggerFilter = taskParameters.getTriggerFilter();
                let deployOptions = {
                    continue: taskParameters.getContinue(),
                    throttle: taskParameters.getThrottle()
                };
                azureModels = new azureModels_1.AzureModels(connectedServiceName);
                let clientId = azureModels.getServicePrincipalClientId();
                let key = azureModels.getServicePrincipalKey();
                let tenantID = azureModels.getTenantId();
                let datafactoryOption = {
                    subscriptionId: azureModels.getSubscriptionId(),
                    resourceGroup: resourceGroup,
                    dataFactoryName: dataFactoryName,
                };
                let hasError = false, firstError;
                task.debug('Parsed task inputs');
                loginAzure(clientId, key, tenantID)
                    .then((azureClient) => {
                    datafactoryOption.azureClient = azureClient;
                    task.debug("Azure client retrieved.");
                    return checkDataFactory(datafactoryOption);
                }).then((result) => {
                    task.debug(`Datafactory '${dataFactoryName}' exist`);
                    let deleteTasks = [];
                    if (triggerFilter !== null) {
                        deleteTasks.push({ filter: triggerFilter, type: DatafactoryTypes.Trigger });
                    }
                    if (pipelineFilter !== null) {
                        deleteTasks.push({ filter: pipelineFilter, type: DatafactoryTypes.Pipeline });
                    }
                    if (datasetFilter !== null) {
                        deleteTasks.push({ filter: datasetFilter, type: DatafactoryTypes.Dataset });
                    }
                    if (serviceFilter !== null) {
                        deleteTasks.push({ filter: serviceFilter, type: DatafactoryTypes.LinkedService });
                    }
                    Q.all(deleteTasks.map(throat(1, (task) => {
                        return hasError ? undefined : deleteItems(datafactoryOption, task.filter, deployOptions, task.type);
                    })))
                        .catch((err) => {
                        firstError = firstError || err;
                        if (!deployOptions.continue) {
                            task.debug('Cancelling delete operations.');
                            hasError = true;
                            reject(firstError);
                        }
                    })
                        .done(() => {
                        if (!hasError) {
                            resolve();
                        }
                    });
                }).catch((err) => {
                    reject(err.message);
                });
            }
            catch (exception) {
                reject(exception);
            }
        }));
        return promise;
    });
}
function wildcardFilter(value, rule) {
    return new RegExp("^" + rule.split("*").join(".*") + "$").test(value);
}
main()
    .then(() => {
    task.setResult(task.TaskResult.Succeeded, "");
})
    .catch((err) => {
    task.setResult(task.TaskResult.Failed, err);
});
