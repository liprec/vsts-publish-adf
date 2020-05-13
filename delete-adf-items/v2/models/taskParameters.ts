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

export enum SortingDirection {
    Ascending,
    Descending,
}

export class TaskParameters {
    private connectedServiceName: string;
    private resourceGroupName: string;
    private datafactoryName: string;

    private serviceFilter: string;
    private pipelineFilter: string;
    private dataflowFilter: string;
    private datasetFilter: string;
    private triggerFilter: string;

    private continue: boolean;
    private throttle: number;
    private sorting: SortingDirection;

    constructor() {
        try {
            this.connectedServiceName = task.getInput("ConnectedServiceName", true);
            this.resourceGroupName = task.getInput("ResourceGroupName", true);
            this.datafactoryName = task.getInput("DatafactoryName", true);

            this.serviceFilter = task.getInput("ServiceFilter", false);
            this.pipelineFilter = task.getInput("PipelineFilter", false);
            this.dataflowFilter = task.getInput("DataflowFilter", false);
            this.datasetFilter = task.getInput("DatasetFilter", false);
            this.triggerFilter = task.getInput("TriggerFilter", false);

            this.continue = task.getBoolInput("Continue", false);
            this.throttle = Number.parseInt(task.getInput("Throttle", false));
            this.throttle = this.throttle === NaN ? 5 : this.throttle;

            let sorting = task.getInput("Sorting", true);
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

    public get ServiceFilter(): string {
        return this.serviceFilter;
    }

    public get PipelineFilter(): string {
        return this.pipelineFilter;
    }

    public get DataflowFilter(): string {
        return this.dataflowFilter;
    }

    public get DatasetFilter(): string {
        return this.datasetFilter;
    }

    public get TriggerFilter(): string {
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
}
