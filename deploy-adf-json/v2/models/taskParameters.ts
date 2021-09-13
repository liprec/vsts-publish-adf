/*
 * Azure Pipelines Azure Datafactory Deploy Task
 *
 * Copyright (c) 2021 Jan Pieter Posthuma / DataScenarios
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

import { getInput, getBoolInput, loc, getPathInput, getVariable } from "azure-pipelines-task-lib/task";

import { SortingDirection } from "../lib/enums";

export class TaskParameters {
    private connectedServiceName: string;
    private resourceGroupName: string;
    private datafactoryName: string;

    private servicePath: string | undefined;
    private pipelinePath: string | undefined;
    private datasetPath: string | undefined;
    private dataflowPath: string | undefined;
    private triggerPath: string | undefined;

    private continue: boolean;
    private throttle: number;
    private sorting: SortingDirection = SortingDirection.Ascending;
    private detectDependency: boolean;

    constructor() {
        try {
            const rootPath = getVariable("System.DefaultWorkingDirectory") || "C:\\";

            this.connectedServiceName = getInput("ConnectedServiceName", true) as string;
            this.resourceGroupName = getInput("ResourceGroupName", true) as string;
            this.datafactoryName = getInput("DatafactoryName", true) as string;

            this.servicePath = getPathInput("ServicePath", false, true);
            this.pipelinePath = getPathInput("PipelinePath", false, true);
            this.datasetPath = getPathInput("DatasetPath", false, true);
            this.dataflowPath = getPathInput("DataflowPath", false, true);
            this.triggerPath = getPathInput("TriggerPath", false, true);

            // Replace "" with undefined
            this.servicePath =
                (this.servicePath && this.servicePath.replace(rootPath, "")) === "" ? undefined : this.servicePath;
            this.pipelinePath =
                (this.pipelinePath && this.pipelinePath.replace(rootPath, "")) === "" ? undefined : this.pipelinePath;
            this.datasetPath =
                (this.datasetPath && this.datasetPath.replace(rootPath, "")) === "" ? undefined : this.datasetPath;
            this.dataflowPath =
                (this.dataflowPath && this.dataflowPath.replace(rootPath, "")) === "" ? undefined : this.dataflowPath;
            this.triggerPath =
                (this.triggerPath && this.triggerPath.replace(rootPath, "")) === "" ? undefined : this.triggerPath;

            this.continue = getBoolInput("Continue", false);
            this.throttle = Number.parseInt(getInput("Throttle", false) as string);
            this.throttle = isNaN(this.throttle) ? 5 : this.throttle;
            this.detectDependency = getBoolInput("detectDependency", false);
            const sorting = getInput("Sorting", true) as string;
            switch (sorting.toLowerCase()) {
                case "ascending":
                    this.sorting = SortingDirection.Ascending;
                    break;
                case "descending":
                    this.sorting = SortingDirection.Descending;
                    break;
            }
        } catch (err: unknown) {
            throw new Error(loc("TaskParameters_ConstructorFailed", (err as Error).message));
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

    public get ServicePath(): string | undefined {
        return this.servicePath;
    }

    public get PipelinePath(): string | undefined {
        return this.pipelinePath;
    }

    public get DatasetPath(): string | undefined {
        return this.datasetPath;
    }

    public get DataflowPath(): string | undefined {
        return this.dataflowPath;
    }

    public get TriggerPath(): string | undefined {
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
