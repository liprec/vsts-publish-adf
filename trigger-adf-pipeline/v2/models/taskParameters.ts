/*
 * Azure Pipelines Azure Data Factory Trigger Pipeline Task
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

import { getInput, getBoolInput, getPathInput, getVariable, loc, warning } from "azure-pipelines-task-lib/task";

export enum PipelineParameterType {
    Inline,
    Path,
}

export class TaskParameters {
    private connectedServiceName: string;
    private resourceGroupName?: string;
    private datafactoryName?: string;
    private workspaceUrl?: string;

    private pipelineFilter: string;
    private pipelineParameterType: PipelineParameterType;
    private pipelineParameter: string;
    private pipelineParameterPath: string | undefined;

    private continue: boolean;
    private throttle: number;
    private deploymentOutputs: string;

    constructor() {
        try {
            const rootPath = getVariable("System.DefaultWorkingDirectory") || "C:\\";

            this.connectedServiceName = getInput("ConnectedServiceName", true) as string;
            this.resourceGroupName = getInput("ResourceGroupName", true) as string;
            this.datafactoryName = getInput("DatafactoryName", true) as string;
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

            this.pipelineFilter = getInput("PipelineFilter", false) || "";
            this.pipelineParameter = getInput("PipelineParameter", false) as string;
            const pipelineParameterType = getInput("PipelineParameterType", false) as string;
            switch ((pipelineParameterType && pipelineParameterType).toLowerCase()) {
                case "path":
                    this.pipelineParameterType = PipelineParameterType.Path;
                    break;
                case "inline":
                default:
                    this.pipelineParameterType = PipelineParameterType.Inline;
                    break;
            }
            this.pipelineParameterPath = getPathInput(
                "PipelineParameterPath",
                false,
                (pipelineParameterType as string).toLowerCase() === "path"
            ) as string;

            this.continue = getBoolInput("Continue", false);
            this.throttle = Number.parseInt(getInput("Throttle", false) as string);
            this.throttle = isNaN(this.throttle) ? 5 : this.throttle;
            this.deploymentOutputs = getInput("deploymentOutputs", false) as string;

            this.pipelineParameterPath =
                (this.pipelineParameterPath && this.pipelineParameterPath).replace(rootPath, "") === ""
                    ? undefined
                    : this.pipelineParameterPath;
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

    public get PipelineFilter(): string {
        return this.pipelineFilter;
    }

    public get PipelineParameterType(): PipelineParameterType {
        return this.pipelineParameterType;
    }

    public get PipelineParameter(): string {
        return this.pipelineParameter;
    }

    public get PipelineParameterPath(): string | undefined {
        return this.pipelineParameterPath;
    }

    public get Continue(): boolean {
        return this.continue;
    }

    public get Throttle(): number {
        return this.throttle;
    }

    public get DeploymentOutputs(): string {
        return this.deploymentOutputs;
    }
}
