/*
 * Azure Pipelines Azure Datafactory Delete Items Task
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

import { getBoolInput, getInput, loc, warning } from "azure-pipelines-task-lib";

import { SortingDirection } from "../lib/enums";

export class TaskParameters {
    private connectedServiceName: string;
    private resourceGroupName?: string;
    private datafactoryName?: string;
    private workspaceUrl?: string;

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
            this.connectedServiceName = getInput("ConnectedServiceName", true) as string;
            this.resourceGroupName = getInput("ResourceGroupName", false) as string;
            this.datafactoryName = getInput("DatafactoryName", false) as string;
            this.workspaceUrl = getInput("WorkspaceUrl", false) as string;

            if (!this.workspaceUrl) {
                if (!this.resourceGroupName) {
                    throw new Error(loc("TaskParameters_MissingResourceGroup"));
                }
                if (!this.datafactoryName) {
                    throw new Error(loc("TaskParameters_MissingDataFactoryName"));
                }
            }
            if (this.workspaceUrl) {
                if (this.resourceGroupName) {
                    warning(loc("TaskParameters_IgnoredParameter", "ResourceGroupName"));
                }
                if (this.datafactoryName) {
                    warning(loc("TaskParameters_IgnoredParameter", "DatafactoryName"));
                }
            }

            this.serviceFilter = getInput("ServiceFilter", false);
            this.pipelineFilter = getInput("PipelineFilter", false);
            this.dataflowFilter = getInput("DataflowFilter", false);
            this.datasetFilter = getInput("DatasetFilter", false);
            this.triggerFilter = getInput("TriggerFilter", false);

            this.serviceFilter = this.serviceFilter === "" ? undefined : this.serviceFilter;
            this.pipelineFilter = this.pipelineFilter === "" ? undefined : this.pipelineFilter;
            this.dataflowFilter = this.dataflowFilter === "" ? undefined : this.dataflowFilter;
            this.datasetFilter = this.datasetFilter === "" ? undefined : this.datasetFilter;
            this.triggerFilter = this.triggerFilter === "" ? undefined : this.triggerFilter;

            this.continue = getBoolInput("Continue", false) as boolean;
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

    public get ResourceGroupName(): string | undefined {
        return this.resourceGroupName;
    }

    public get DatafactoryName(): string | undefined {
        return this.datafactoryName;
    }

    public get WorkspaceUrl(): string | undefined {
        if (this.workspaceUrl) return new URL(this.workspaceUrl as string).hostname;
    }

    public get Audience(): string {
        if (this.workspaceUrl) return "https://dev.azuresynapse.net/.default";
        return "https://management.azure.com/.default";
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
