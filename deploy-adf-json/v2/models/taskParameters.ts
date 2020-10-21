/*
 * Azure Pipelines Azure Datafactory Deploy Task
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

import * as task from "azure-pipelines-task-lib/task";

export enum SortingDirection {
    Ascending,
    Descending,
}

export class TaskParameters {
    private connectedServiceName: string;
    private resourceGroupName: string;
    private datafactoryName: string;

    private servicePath: string | null;
    private pipelinePath: string | null;
    private datasetPath: string | null;
    private dataflowPath: string | null;
    private triggerPath: string | null;

    private continue: boolean;
    private throttle: number;
    private sorting: SortingDirection = SortingDirection.Ascending;
    private detectDependency: boolean;

    constructor() {
        try {
            let rootPath = task.getVariable("System.DefaultWorkingDirectory") || "C:\\";

            this.connectedServiceName = <string>task.getInput("ConnectedServiceName", true);
            this.resourceGroupName = <string>task.getInput("ResourceGroupName", true);
            this.datafactoryName = <string>task.getInput("DatafactoryName", true);

            this.servicePath = <string>task.getPathInput("ServicePath", false, true);
            this.pipelinePath = <string>task.getPathInput("PipelinePath", false, true);
            this.datasetPath = <string>task.getPathInput("DatasetPath", false, true);
            this.dataflowPath = <string>task.getPathInput("DataflowPath", false, true);
            this.triggerPath = <string>task.getPathInput("TriggerPath", false, true);

            // Replace "" with null
            this.servicePath = this.servicePath.replace(rootPath, "") === "" ? null : this.servicePath;
            this.pipelinePath = this.pipelinePath.replace(rootPath, "") === "" ? null : this.pipelinePath;
            this.datasetPath = this.datasetPath.replace(rootPath, "") === "" ? null : this.datasetPath;
            this.dataflowPath = this.dataflowPath.replace(rootPath, "") === "" ? null : this.dataflowPath;
            this.triggerPath = this.triggerPath.replace(rootPath, "") === "" ? null : this.triggerPath;

            this.continue = task.getBoolInput("Continue", false);
            this.throttle = Number.parseInt(<string>task.getInput("Throttle", false));
            this.throttle = this.throttle === NaN ? 5 : this.throttle;
            this.detectDependency = task.getBoolInput("detectDependency", false);
            let sorting = <string>task.getInput("Sorting", true);
            switch (sorting.toLowerCase()) {
                case "ascending":
                    this.sorting = SortingDirection.Ascending;
                    break;
                case "descending":
                    this.sorting = SortingDirection.Descending;
                    break;
            }
        } catch (err) {
            throw new Error(task.loc("TaskParameters_ConstructorFailed", err.message));
        }
    }

    public get ConnectedServiceName(): string {
        return this.connectedServiceName;
    }

    public get ResourceGroupName(): string {
        return this.resourceGroupName;
    }

    public get DatafactoryName(): string {
        return this.datafactoryName;
    }

    public get ServicePath(): string | null {
        return this.servicePath;
    }

    public get PipelinePath(): string | null {
        return this.pipelinePath;
    }

    public get DatasetPath(): string | null {
        return this.datasetPath;
    }

    public get DataflowPath(): string | null {
        return this.dataflowPath;
    }

    public get TriggerPath(): string | null {
        return this.triggerPath;
    }

    public get Continue(): boolean {
        return this.continue;
    }

    public get Throttle(): number {
        return this.throttle;
    }

    public get Sorting(): SortingDirection {
        return this.sorting;
    }

    public get DetectDependency(): boolean {
        return this.detectDependency;
    }
}
