/*
 * Azure Pipelines Azure Datafactory Trigger Task
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

import { getInput, getBoolInput, loc, warning } from "azure-pipelines-task-lib/task";

import { DatafactoryToggle } from "../lib/enums";

export class TaskParameters {
    private connectedServiceName: string;
    private resourceGroupName?: string;
    private datafactoryName?: string;
    private workspaceUrl?: string;

    private triggerFilter: string;
    private triggerStatus: DatafactoryToggle = DatafactoryToggle.Stop;

    private continue: boolean;
    private throttle: number;

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

            this.triggerFilter = getInput("TriggerFilter", false) || "";
            const status = getInput("TriggerStatus", true) as string;
            switch (status.toLowerCase()) {
                case "start":
                    this.triggerStatus = DatafactoryToggle.Start;
                    break;
                case "stop":
                default:
                    this.triggerStatus = DatafactoryToggle.Stop;
                    break;
            }

            this.continue = getBoolInput("Continue", false);
            this.throttle = Number.parseInt(getInput("Throttle", false) as string);
            this.throttle = isNaN(this.throttle) ? 5 : this.throttle;
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

    public get Audience(): string | undefined {
        if (this.workspaceUrl) return "https://dev.azuresynapse.net/";
    }

    public get TriggerFilter(): string {
        return this.triggerFilter;
    }

    public get TriggerStatus(): DatafactoryToggle {
        return this.triggerStatus;
    }

    public get Continue(): boolean {
        return this.continue;
    }

    public get Throttle(): number {
        return this.throttle;
    }
}
