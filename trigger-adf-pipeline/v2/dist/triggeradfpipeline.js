"use strict";
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
    DatafactoryTypes["Pipeline"] = "Pipeline";
    DatafactoryTypes["Dataset"] = "Dataset";
    DatafactoryTypes["Trigger"] = "Trigger";
    DatafactoryTypes["LinkedService"] = "Linked Service";
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
function getPipelines(datafactoryOption, filter) {
    return new Promise((resolve, reject) => {
        let azureClient = datafactoryOption.azureClient, subscriptionId = datafactoryOption.subscriptionId, resourceGroup = datafactoryOption.resourceGroup, dataFactoryName = datafactoryOption.dataFactoryName;
        let options = {
            method: 'GET',
            url: `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DataFactory/factories/${dataFactoryName}/pipelines?api-version=2018-06-01`,
            serializationMapper: null,
            deserializationMapper: null
        };
        let request = azureClient.sendRequest(options, (err, result, request, response) => {
            if (err) {
                task.error(task.loc("TriggerAdfPipelines_GetPipelines", err.message));
                reject(task.loc("TriggerAdfPipelines_GetPipelines", err.message));
            }
            else if (response.statusCode !== 200) {
                task.debug(task.loc("TriggerAdfPipelines_GetPipelines2"));
                reject(task.loc("TriggerAdfPipelines_GetPipelines2"));
            }
            else {
                let objects = JSON.parse(JSON.stringify(result));
                let items = objects.value;
                items = items.filter((item) => { return wildcardFilter(item.name, filter); });
                console.log(`Found ${items.length} pipeline(s).`);
                resolve(items.map((value) => { return { pipelineName: value.name }; }));
            }
        });
    });
}
function triggerPipeline(datafactoryOption, deployOptions, pipeline) {
    return new Promise((resolve, reject) => {
        let azureClient = datafactoryOption.azureClient, subscriptionId = datafactoryOption.subscriptionId, resourceGroup = datafactoryOption.resourceGroup, dataFactoryName = datafactoryOption.dataFactoryName;
        let pipelineName = pipeline.pipelineName;
        let options = {
            method: 'POST',
            url: `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DataFactory/factories/${dataFactoryName}/pipelines/${pipelineName}/createRun?api-version=2018-06-01`,
            serializationMapper: null,
            deserializationMapper: null
        };
        let request = azureClient.sendRequest(options, (err, result, request, response) => {
            if (err) {
                task.error(task.loc("TriggerAdfPipelines_TriggerPipeline", pipelineName, err.message));
                reject(task.loc("TriggerAdfPipelines_TriggerPipeline", pipelineName, err.message));
            }
            else if ((response.statusCode !== 200) && (response.statusCode !== 204)) {
                resolve(false);
            }
            else if (response.statusCode === 204) {
                task.debug(`'${pipelineName}' not found.`);
            }
            else {
                resolve(true);
            }
        });
    });
}
function triggerPipelines(datafactoryOption, deployOptions, filter) {
    return new Promise((resolve, reject) => {
        getPipelines(datafactoryOption, filter)
            .then((pipelines) => {
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
function processPipelines(datafactoryOption, deployOptions, pipelines) {
    let firstError;
    return new Promise((resolve, reject) => {
        let totalItems = pipelines.length;
        let process = Q.all(pipelines.map(throat(deployOptions.throttle, (pipeline) => {
            console.log(`Trigger pipeline '${pipeline.pipelineName}'.`);
            return triggerPipeline(datafactoryOption, deployOptions, pipeline);
        })))
            .catch((err) => {
            hasError = true;
            firstError = firstError || err;
        })
            .done(() => {
            task.debug(`${totalItems} pipeline(s) triggered.`);
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
                let pipelineFilter = taskParameters.getPipelineFilter();
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
                let firstError;
                task.debug('Parsed task inputs');
                loginAzure(clientId, key, tenantID)
                    .then((azureClient) => {
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
                            }
                            else {
                                resolve();
                            }
                        });
                    }
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
// Set generic error flag
let hasError = false;
main()
    .then(() => {
    task.setResult(task.TaskResult.Succeeded, "");
})
    .catch((err) => {
    task.setResult(task.TaskResult.Failed, err);
});
