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

import { getInput, getBoolInput, loc } from "azure-pipelines-task-lib/task";

import { DatafactoryToggle } from "../lib/enums";

export class TaskParameters {
    private connectedServiceName: string;
    private azureManagementUri: string;
    private resourceGroupName: string;
    private datafactoryName: string;

    private triggerFilter: string;
    private triggerStatus: DatafactoryToggle = DatafactoryToggle.Stop;

    private continue: boolean;
    private throttle: number;

    constructor() {
        try {
            this.connectedServiceName = getInput("ConnectedServiceName", true) as string;
            this.azureManagementUri = getInput("AzureManagementUri", true) as string;
            this.resourceGroupName = getInput("ResourceGroupName", true) as string;
            this.datafactoryName = getInput("DatafactoryName", true) as string;
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

    public get AzureManagementUri(): string {
        return this.azureManagementUri;
    }

    public get ResourceGroupName(): string {
        return this.resourceGroupName;
    }

    public get DatafactoryName(): string {
        return this.datafactoryName;
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
