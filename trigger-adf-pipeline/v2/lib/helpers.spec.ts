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

"use strict";

import { strict as assert } from "assert";

import { wildcardFilter } from "./helpers";

describe("helpers.ts", function () {
    describe("wildcardFilter()", () => {
        describe("old wildcard functionality", () => {
            it("validate 'trigger' with rule 'trigge*r' => true", () => {
                assert.strictEqual(wildcardFilter("trigger", "trigge*r"), true);
            });

            it("validate 'triggetr' with rule 'trigge*r' => true", () => {
                assert.strictEqual(wildcardFilter("triggetr", "trigge*r"), true);
            });
        });

        describe("new RegExp functionality", () => {
            it("validate 'triggetr' with rule 'trigge.r' => true", () => {
                assert.strictEqual(wildcardFilter("triggetr", "trigge.r"), true);
            });

            it("validate 'triggettr' with rule 'trigge.*r' => true", () => {
                assert.strictEqual(wildcardFilter("triggettr", "trigge.*r"), true);
            });

            it("validate 'triggettr' with rule 'trigge.r' => false", () => {
                assert.strictEqual(wildcardFilter("triggettr", "trigge.r"), false);
            });
        });
    });
});
