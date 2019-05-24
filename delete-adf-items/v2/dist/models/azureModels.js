"use strict";
/*
 * VSTS Delete ADF Items Task
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
Object.defineProperty(exports, "__esModule", { value: true });
const task = require("vsts-task-lib/task");
class AzureModels {
    constructor(connectedServiceName) {
        try {
            this.connectedServiceName = connectedServiceName;
            if (this.connectedServiceName === 'local') { // local debug
                this.subscriptionId = task.getInput('subscriptionid', true);
                this.subscriptionName = task.getInput('subscriptionname', true);
                this.servicePrincipalClientId = task.getInput('serviceprincipalid', true);
                this.servicePrincipalKey = task.getInput('serviceprincipalkey', true);
                this.environmentAuthorityUrl = task.getInput('environmentAuthorityUrl', true);
                this.tenantId = task.getInput('tenantid', true);
                this.url = task.getInput('connectedServiceNameUrl', true);
            }
            else {
                this.subscriptionId = task.getEndpointDataParameter(this.connectedServiceName, 'subscriptionid', true);
                this.subscriptionName = task.getEndpointDataParameter(this.connectedServiceName, 'subscriptionname', true);
                this.servicePrincipalClientId = task.getEndpointAuthorizationParameter(this.connectedServiceName, 'serviceprincipalid', true);
                this.servicePrincipalKey = task.getEndpointAuthorizationParameter(this.connectedServiceName, 'serviceprincipalkey', true);
                this.environmentAuthorityUrl = task.getEndpointDataParameter(this.connectedServiceName, 'environmentAuthorityUrl', true);
                this.tenantId = task.getEndpointAuthorizationParameter(this.connectedServiceName, 'tenantid', false);
                this.url = task.getEndpointUrl(this.connectedServiceName, true);
            }
        }
        catch (err) {
            throw new Error(task.loc("AzureModels_ConstructorFailed", err.message));
        }
    }
    getSubscriptionId() {
        return this.subscriptionId;
    }
    getSubscriptionName() {
        return this.subscriptionName;
    }
    getServicePrincipalClientId() {
        return this.servicePrincipalClientId;
    }
    getServicePrincipalKey() {
        return this.servicePrincipalKey;
    }
    getEnvironmentAuthorityUrl() {
        return this.environmentAuthorityUrl;
    }
    getTenantId() {
        return this.tenantId;
    }
    getUrl() {
        return this.url;
    }
}
exports.AzureModels = AzureModels;
