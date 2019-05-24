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

import Q = require('q');
import throat = require('throat');
import task = require('vsts-task-lib/task');
import fs = require('fs');
import path = require('path');
import msRestAzure = require('ms-rest-azure');
import { TaskParameters } from './models/taskParameters';
import { AzureModels } from './models/azureModels';

import AzureServiceClient = msRestAzure.AzureServiceClient;
import { UrlBasedRequestPrepareOptions } from 'ms-rest';

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

interface DataFactoryDeployOptions {
    continue: boolean,
    throttle: number
}

interface DatafactoryDeployObject {
    name: string,
    json: string,
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

function getObjects(datafactoryType: DatafactoryTypes, deployOptions: DataFactoryDeployOptions, folder: string): Promise<DatafactoryDeployObject[]> {
    return new Promise<DatafactoryDeployObject[]>((resolve, reject) => {
        let sourceFolder = path.normalize(folder);
        let allPaths: string[] = task.find(sourceFolder); // default find options (follow sym links)
        let matchedFiles: string[] = allPaths.filter((itemPath: string) => !task.stats(itemPath).isDirectory()); // filter-out directories
        if (matchedFiles.length > 0) {
            console.log(`Found ${matchedFiles.length} ${datafactoryType}(s) definitions.`);
            resolve(matchedFiles.map((file: string) => {
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

function deployItem(datafactoryOption: DatafactoryOptions, deployOptions: DataFactoryDeployOptions, item: DatafactoryDeployObject): Promise<boolean> {
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
            } else if (response.statusCode!==200) {
                if (deployOptions.continue) {
                    task.warning(task.loc("DeployAdfJson_DeployItems2", item.name, item.type, JSON.stringify(result)));
                    resolve(false);
                } else {
                    reject(task.loc("DeployAdfJson_DeployItems2", item.name, item.type, JSON.stringify(result)));
                }
            } else {
                resolve(true);
            }
        });
        
    });
}

function deployItems(datafactoryOption: DatafactoryOptions, folder:string, deployOptions: DataFactoryDeployOptions, datafactoryType: DatafactoryTypes): Promise<boolean> {
    if (hasError) { return } // Some error occurred, so returning
    return new Promise<boolean>((resolve, reject) => {
        getObjects(datafactoryType, deployOptions, folder)
            .then((items: DatafactoryDeployObject[]) => {
                processItems(datafactoryOption, deployOptions, datafactoryType, items)
                    .catch((err) => {
                        reject(err);
                    })
                    .then((result: boolean) => {
                        resolve(result);
                    });
            })
            .catch((err) => {
                task.debug(task.loc("DeployAdfJson_DeployItems", folder, err.message));
                reject(task.loc("DeployAdfJson_DeployItems", folder, err.message));
            });
    });
}

function processItems(datafactoryOption: DatafactoryOptions, deployOptions: DataFactoryDeployOptions, datafactoryType: DatafactoryTypes, items: DatafactoryDeployObject[]): Promise<boolean> {
    let firstError; 
    return new Promise<boolean>((resolve, reject) => {
        let totalItems = items.length;

        let process = Q.all(items.map(throat(deployOptions.throttle, (item) => {
                console.log(`Deploy ${datafactoryType} '${item.name}'.`);
                return deployItem(datafactoryOption, deployOptions, item); 
            })))
            .catch((err) => {
                hasError = true;
                firstError = firstError || err;
            })
            .done((results) => { 
                task.debug(`${totalItems} ${datafactoryType}(s) deployed.`); 
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
            let connectedServiceName = taskParameters.getConnectedServiceName();
            let resourceGroup = taskParameters.getResourceGroupName();
            let dataFactoryName = taskParameters.getDatafactoryName();

            let servicePath = taskParameters.getServicePath();
            let pipelinePath = taskParameters.getPipelinePath();
            let datasetPath = taskParameters.getDatasetPath();
            let triggerPath = taskParameters.getTriggerPath();

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
            let firstError;
            task.debug('Parsed task inputs');
            
            loginAzure(clientId, key, tenantID)
                .then((azureClient: AzureServiceClient) => {
                    datafactoryOption.azureClient = azureClient;
                    task.debug("Azure client retrieved.");
                    return checkDataFactory(datafactoryOption);
            }).then(() => {
                task.debug(`Datafactory '${dataFactoryName}' exist`);
                let deployTasks = [];
                if (servicePath !== null) {
                    deployTasks.push({path: servicePath, type: DatafactoryTypes.LinkedService});
                }
                if (datasetPath !== null) {
                    deployTasks.push({path: datasetPath, type: DatafactoryTypes.Dataset});
                }
                if (pipelinePath !== null) {
                    deployTasks.push({path: pipelinePath, type: DatafactoryTypes.Pipeline});
                }
                if (triggerPath !== null) {
                    deployTasks.push({path: triggerPath, type: DatafactoryTypes.Trigger});
                }
                Q.all(deployTasks.map(throat(1, (task) => {
                        return deployItems(datafactoryOption, task.path, deployOptions, task.type); 
                    })))
                    .catch((err) => {
                        hasError = true;
                        firstError = firstError || err;
                    })
                    .done((results) => {
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

// Set generic error flag
let hasError = false;

main()
    .then((result) => {
        task.setResult(result ? task.TaskResult.Succeeded : task.TaskResult.SucceededWithIssues, "");
    })
    .catch((err) => { 
        task.setResult(task.TaskResult.Failed, err); 
    });
