/*
 * VSTS Azure Data Factory (V2) Trigger Task
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

export enum DatafactoryToggle {
    Start = 'start',
    Stop = 'stop'
}

export class TaskParameters {

    private connectedServiceName: string;
    private resourceGroupName: string;
    private datafactoryName: string;

    private triggerFilter: string;
    private triggerStatus: DatafactoryToggle;

    private continue: boolean;
    private throttle: number;

    constructor() {
        try {
            let rootPath = task.getVariable("System.DefaultWorkingDirectory") || "C:\\";

            this.connectedServiceName = task.getInput('ConnectedServiceName', true);
            this.resourceGroupName = task.getInput('ResourceGroupName', true);
            this.datafactoryName = task.getInput('DatafactoryName', true);

            this.triggerFilter = task.getInput('TriggerFilter', true);
            let status = task.getInput('TriggerStatus', true);
            switch (status) {
                case 'Start':
                    this.triggerStatus = DatafactoryToggle.Start
                    break;
                case 'Stop':
                    this.triggerStatus = DatafactoryToggle.Stop
                    break;
            }
            
            this.continue = task.getBoolInput('Continue', false);
            this.throttle = Number.parseInt(task.getInput('Throttle', false));
            this.throttle = (this.throttle === NaN ? 5 : this.throttle);
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

    public getTriggerFilter(): string {
        return this.triggerFilter;
    }

    public getTriggerStatus(): DatafactoryToggle {
        return this.triggerStatus;
    }

    public getContinue(): boolean {
        return this.continue;
    }

    public getThrottle(): number {
        return this.throttle;
    }
}