"use strict";
/*
 * VSTS Azure Datafactory Deploy Task
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
const fs = require("fs");
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
function getObjects(datafactoryType, deployOptions, folder) {
    return new Promise((resolve, reject) => {
        let sourceFolder = path.normalize(folder);
        let allPaths = task.find(sourceFolder); // default find options (follow sym links)
        let matchedFiles = allPaths.filter((itemPath) => !task.stats(itemPath).isDirectory()); // filter-out directories
        if (matchedFiles.length > 0) {
            console.log(`Found ${matchedFiles.length} ${datafactoryType}(s) definitions.`);
            resolve(matchedFiles.map((file) => {
                let data = fs.readFileSync(file, 'utf8');
                let json = JSON.parse(data);
                let name = json.name || path.parse(file).name.replace(' ', '_');
                return {
                    name: name,
                    json: JSON.stringify(json),
                    type: datafactoryType
                };
            }));
        }
    });
}
function deployItem(datafactoryOption, deployOptions, item) {
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
            method: 'PUT',
            url: `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DataFactory/factories/${dataFactoryName}/${objectType}/${objectName}?api-version=2018-06-01`,
            serializationMapper: null,
            deserializationMapper: null,
            headers: {
                'Content-Type': 'application/json'
            },
            body: item.json,
            disableJsonStringifyOnBody: true
        };
        let request = azureClient.sendRequest(options, (err, result, request, response) => {
            if ((err) && (!deployOptions.continue)) {
                task.error(task.loc("DeployAdfJson_DeployItems2", item.name, item.type, err.message));
                reject(task.loc("DeployAdfJson_DeployItems2", item.name, item.type, err.message));
            }
            else if (response.statusCode !== 200) {
                if (deployOptions.continue) {
                    task.warning(task.loc("DeployAdfJson_DeployItems2", item.name, item.type, JSON.stringify(result)));
                    resolve(false);
                }
                else {
                    reject(task.loc("DeployAdfJson_DeployItems2", item.name, item.type, JSON.stringify(result)));
                }
            }
            else {
                resolve(true);
            }
        });
    });
}
function deployItems(datafactoryOption, folder, deployOptions, datafactoryType) {
    if (hasError) {
        return;
    } // Some error occurred, so returning
    return new Promise((resolve, reject) => {
        getObjects(datafactoryType, deployOptions, folder)
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
            task.debug(task.loc("DeployAdfJson_DeployItems", folder, err.message));
            reject(task.loc("DeployAdfJson_DeployItems", folder, err.message));
        });
    });
}
function processItems(datafactoryOption, deployOptions, datafactoryType, items, throttle = 5) {
    let firstError;
    return new Promise((resolve, reject) => {
        let totalItems = items.length;
        let process = Q.all(items.map(throat(throttle, (item) => {
            console.log(`Deploy ${datafactoryType} '${item.name}'.`);
            return deployItem(datafactoryOption, deployOptions, item);
        })))
            .catch((err) => {
            hasError = true;
            firstError = firstError || err;
        })
            .done(() => {
            task.debug(`${totalItems} ${datafactoryType}(s) deployed.`);
            if (hasError) {
                reject(firstError);
            }
            else {
                resolve(true);
            }
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
                let servicePath = taskParameters.getServicePath();
                let pipelinePath = taskParameters.getPipelinePath();
                let datasetPath = taskParameters.getDatasetPath();
                let triggerPath = taskParameters.getTriggerPath();
                let deployOptions = {
                    continue: taskParameters.getContinue()
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
                let firstError;
                task.debug('Parsed task inputs');
                loginAzure(clientId, key, tenantID)
                    .then((azureClient) => {
                    datafactoryOption.azureClient = azureClient;
                    task.debug("Azure client retrieved.");
                    return checkDataFactory(datafactoryOption);
                }).then(() => {
                    task.debug(`Datafactory '${dataFactoryName}' exist`);
                    let deployTasks = [];
                    if (servicePath !== null) {
                        deployTasks.push({ path: servicePath, type: DatafactoryTypes.LinkedService });
                    }
                    if (datasetPath !== null) {
                        deployTasks.push({ path: datasetPath, type: DatafactoryTypes.Dataset });
                    }
                    if (pipelinePath !== null) {
                        deployTasks.push({ path: pipelinePath, type: DatafactoryTypes.Pipeline });
                    }
                    if (triggerPath !== null) {
                        deployTasks.push({ path: triggerPath, type: DatafactoryTypes.Trigger });
                    }
                    Q.all(deployTasks.map(throat(1, (task) => {
                        return deployItems(datafactoryOption, task.path, deployOptions, task.type);
                    })))
                        .catch((err) => {
                        hasError = true;
                        firstError = firstError || err;
                    })
                        .done(() => {
                        if (hasError) {
                            reject(firstError);
                        }
                        else {
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
// Set generic error flag
let hasError = false;
main()
    .then(() => {
    task.setResult(task.TaskResult.Succeeded, "");
})
    .catch((err) => {
    task.setResult(task.TaskResult.Failed, err);
});
//# sourceMappingURL=deployadfjson.js.map