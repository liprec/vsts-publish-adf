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

import { DatafactoryTypes } from "./enums";
import { DatafactoryTaskObject } from "./interfaces";

export function addSummary(
    totalItems: number,
    issues: number,
    datafactoryType: DatafactoryTypes,
    action: string,
    size: number | undefined,
    duration: number
) {
    console.log(``);
    if (issues > 0) console.log(`${issues} ${datafactoryType}(s) failed`);
    console.log(`${totalItems - issues} ${datafactoryType}(s) ${action}.\n\nStats:`);
    console.log(`======`);
    if (size) console.log(`Total size:\t${getReadableFileSize(size)}.`);
    console.log(`Duration:\t${getReadableInterval(duration)}.`);
    if (size) console.log(`Performance:\t${getReadableFileSize(size / (duration / 1000))}/sec.`);
    console.log(`\t\t${(totalItems / (duration / 1000)).toFixed(1)} items/sec.`);
}

export function getReadableFileSize(fileSizeInBytes: number): string {
    var i = 0;
    var byteUnits = [" bytes", " kB", " MB", " GB", " TB", "PB", "EB", "ZB", "YB"];
    while (fileSizeInBytes > 1024) {
        fileSizeInBytes = fileSizeInBytes / 1024;
        i++;
    }

    return Math.max(fileSizeInBytes, 0.1).toFixed(1) + byteUnits[i];
}

export function getReadableInterval(interval: number): string {
    let x = interval / 1000;
    const seconds = (x % 60).toFixed(3);
    x /= 60;
    const minutes = Math.floor(x % 60);
    x /= 60;
    const hours = Math.floor(x % 24);
    let r = "";
    if (hours !== 0) r += hours + " hour(s) ";
    if (minutes !== 0) r += (minutes < 10 && hours > 0 ? "0" : "") + minutes + " minute(s) ";
    return r + seconds + " second(s)";
}

export function splitBuckets(detectDependency: boolean, items: DatafactoryTaskObject[]): number {
    let loop = detectDependency;
    let change = true;
    let numberOfBuckets = 1;
    while (loop || change) {
        loop = false;
        change = false;
        const loopItems = items.filter((item: DatafactoryTaskObject) => item.bucket === -1);
        loopItems.forEach((item: DatafactoryTaskObject) => {
            const pBucket = item.bucket;
            const buckets = item.dependency.map((i) => {
                const findItem = items.find((item) => item.name === i);
                if (!findItem) return -1;
                return findItem.bucket;
            });
            if (Math.min(...buckets) !== -1) {
                numberOfBuckets++;
                change = true;
                item.bucket = Math.max(...buckets) + 1;
            }
            loop = pBucket !== item.bucket;
        });
    }
    return numberOfBuckets;
}

export function findDependency(json: any, type: string): string[] {
    let refs: string[] = [];
    if (json.referenceName && json.type === type) {
        return [json.referenceName];
    }
    for (const key in json) {
        if (typeof json[key] === typeof [Object]) refs = refs.concat(findDependency(json[key], type));
    }
    return refs.filter((current: string, index: number, array: string[]) => array.indexOf(current) === index);
}
