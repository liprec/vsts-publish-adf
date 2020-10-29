/*
 * Azure Pipelines Azure Datafactory Delete Items Task
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
import { exit } from "process";

import { SortingDirection } from "../lib/enums";

export class TaskParameters {
    private connectedServiceName: string;
    private resourceGroupName: string;
    private datafactoryName: string;

    private serviceFilter: string | undefined;
    private pipelineFilter: string | undefined;
    private dataflowFilter: string | undefined;
    private datasetFilter: string | undefined;
    private triggerFilter: string | undefined;

    private continue: boolean;
    private throttle: number;
    private sorting: SortingDirection = SortingDirection.Ascending;
    private detectDependency: boolean;

    constructor() {
        try {
            this.connectedServiceName = <string>task.getInput("ConnectedServiceName", true);
            this.resourceGroupName = <string>task.getInput("ResourceGroupName", true);
            this.datafactoryName = <string>task.getInput("DatafactoryName", true);

            this.serviceFilter = task.getInput("ServiceFilter", false);
            this.pipelineFilter = task.getInput("PipelineFilter", false);
            this.dataflowFilter = task.getInput("DataflowFilter", false);
            this.datasetFilter = task.getInput("DatasetFilter", false);
            this.triggerFilter = task.getInput("TriggerFilter", false);

            this.serviceFilter = this.serviceFilter === "" ? undefined : this.serviceFilter;
            this.pipelineFilter = this.pipelineFilter === "" ? undefined : this.pipelineFilter;
            this.dataflowFilter = this.dataflowFilter === "" ? undefined : this.dataflowFilter;
            this.datasetFilter = this.datasetFilter === "" ? undefined : this.datasetFilter;
            this.triggerFilter = this.triggerFilter === "" ? undefined : this.triggerFilter;

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

    public get ServiceFilter(): string | undefined {
        return this.serviceFilter;
    }

    public get PipelineFilter(): string | undefined {
        return this.pipelineFilter;
    }

    public get DataflowFilter(): string | undefined {
        return this.dataflowFilter;
    }

    public get DatasetFilter(): string | undefined {
        return this.datasetFilter;
    }

    public get TriggerFilter(): string | undefined {
        return this.triggerFilter;
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
