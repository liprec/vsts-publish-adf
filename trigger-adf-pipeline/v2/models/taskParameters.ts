/*
 * Azure Pipelines Azure Datafactory Pipeline Task
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

import { getInput, getBoolInput, loc, getPathInput, getVariable } from "azure-pipelines-task-lib/task";

export enum PipelineParameterType {
    Inline,
    Path,
}

export class TaskParameters {
    private connectedServiceName: string;
    private resourceGroupName: string;
    private datafactoryName: string;

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

            this.connectedServiceName = <string>getInput("ConnectedServiceName", true);
            this.resourceGroupName = <string>getInput("ResourceGroupName", true);
            this.datafactoryName = <string>getInput("DatafactoryName", true);

            this.pipelineFilter = <string>getInput("PipelineFilter", false) || "";
            this.pipelineParameter = <string>getInput("PipelineParameter", false);
            const pipelineParameterType = <string>getInput("PipelineParameterType", false);
            switch ((pipelineParameterType && pipelineParameterType).toLowerCase()) {
                case "path":
                    this.pipelineParameterType = PipelineParameterType.Path;
                    break;
                case "inline":
                default:
                    this.pipelineParameterType = PipelineParameterType.Inline;
                    break;
            }
            this.pipelineParameterPath = <string>(
                getPathInput("PipelineParameterPath", false, (<string>pipelineParameterType).toLowerCase() === "path")
            );

            this.continue = getBoolInput("Continue", false);
            this.throttle = Number.parseInt(<string>getInput("Throttle", false));
            this.throttle = this.throttle === NaN ? 5 : this.throttle;
            this.deploymentOutputs = <string>getInput("deploymentOutputs", false);

            this.pipelineParameterPath =
                (this.pipelineParameterPath && this.pipelineParameterPath).replace(rootPath, "") === ""
                    ? undefined
                    : this.pipelineParameterPath;
        } catch (err) {
            throw new Error(loc("TaskParameters_ConstructorFailed", err.message));
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
