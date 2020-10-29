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

import { getReadableFileSize, getReadableInterval } from "./helpers";

describe("Helpers", () => {
    describe("getReadableInterval()", () => {
        it("59000 => '59.000 second(s)'", () => {
            assert.strictEqual(getReadableInterval(59000), "59.000 second(s)");
        });

        it("59001 => '59.001 second(s)'", () => {
            assert.strictEqual(getReadableInterval(59001), "59.001 second(s)");
        });

        it("60001 => '1 minute(s) 0.001 seconds'", () => {
            assert.strictEqual(getReadableInterval(60001), "1 minute(s) 0.001 second(s)");
        });
    });

    describe("getReadableFileSize()", () => {
        it("1000 => 1000 byte", () => {
            assert.strictEqual(getReadableFileSize(1000), "1000.0 bytes");
        });
    });

    describe("getReadableFileSize()", () => {
        it("1024 => 1024.0 bytes", () => {
            assert.strictEqual(getReadableFileSize(1024), "1024.0 bytes");
        });
    });

    describe("getReadableFileSize()", () => {
        it("1025 => 1.0 kB", () => {
            assert.strictEqual(getReadableFileSize(1025), "1.0 kB");
        });
    });
});
