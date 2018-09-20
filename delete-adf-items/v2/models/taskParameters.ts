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

import task = require("vsts-task-lib/task");

export class TaskParameters {

    private connectedServiceName: string;
    private resourceGroupName: string;
    private datafactoryName: string;

    private serviceFilter: string;
    private pipelineFilter: string;
    private datasetFilter: string;
    private triggerFilter: string;

    private continue: boolean;

    constructor() {
        try {
            this.connectedServiceName = task.getInput('ConnectedServiceName', true);
            this.resourceGroupName = task.getInput('ResourceGroupName', true);
            this.datafactoryName = task.getInput('DatafactoryName', true);

            this.serviceFilter = task.getInput('ServiceFilter', false);
            this.pipelineFilter = task.getInput('PipelineFilter', false);
            this.datasetFilter = task.getInput('DatasetFilter', false);
            this.triggerFilter = task.getInput('TriggerFilter', false);

            this.continue = task.getBoolInput('Continue', false);
        }
        catch (err) {
            throw new Error(task.loc("TaskParameters_ConstructorFailed", err.message));
        }
    }

    public getConnectedServiceName(): string {
        return this.connectedServiceName;
    }

    public getResourceGroupName(): string {
        return this.resourceGroupName;
    }
    
    public getDatafactoryName(): string {
        return this.datafactoryName;
    }

    public getServiceFilter(): string {
        return this.serviceFilter;
    }

    public getPipelineFilter(): string {
        return this.pipelineFilter;
    }

    public getDatasetFilter(): string {
        return this.datasetFilter;
    }

    public getTriggerFilter(): string {
        return this.triggerFilter;
    }

    public getContinue(): boolean {
        return this.continue;
    }
}
