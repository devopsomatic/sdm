/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { allSatisfied, PushMapping, PushRules, PushTest } from "../..";

/**
 * Simple DSL to create a decision tree
 * @param givenPushTests PushTests
 * @return interim DSL structure
 */
export function given<V>(...givenPushTests: PushTest[]) {
    return new TreeContext<V>(givenPushTests);
}

export class TreeContext<V> {

    constructor(private readonly givenPushTests: PushTest[]) {}

    /**
     * Perform any computation necessary to initialize this branch:
     * for example, setting variables in scope
     * @param {(t: this) => any} f
     * @return {any}
     */
    public init(f: (t: this) => any): any {
        f(this);
        return this;
    }

    public itMeans(name: string): GivenTree<V> {
        const givenPushTest = allSatisfied(...this.givenPushTests);
        return new GivenTree<V>(givenPushTest, name);
    }
}

/**
 * Tree. Can compute variables
 */
export class GivenTree<V> {

    constructor(private readonly givenPushTest: PushTest, private readonly name: string) {}

    /**
     * Perform computation before continuing.
     * Typically used to set values that will be used in predicate expressions.
     * @param {(t: this) => any} f
     * @return {any}
     */
    public compute(f: (t: this) => any): any {
        f(this);
        return this;
    }

    /**
     * Set the resolution value of this tree
     * @param {V} value
     * @return {PushMapping<V>}
     */
    public set(value: V): PushMapping<V> {
        return {
            name: this.name,
            valueForPush: async () => value,
        };
    }

    /**
     * Enter a subtree of a number of mappings. Can be use
     * to nest trees to arbitrary depth.
     * @param {PushMapping<V>} pushMappings
     * @return {PushMapping<V>}
     */
    public then(...pushMappings: Array<PushMapping<V>>): PushMapping<V> {
        const rules = new PushRules<V>(this.name, pushMappings);
        return {
            name: this.name,
            valueForPush: async pli => {
                const eligible = await this.givenPushTest.valueForPush(pli);
                return eligible ? rules.valueForPush(pli) : undefined;
            },
        };
    }
}
