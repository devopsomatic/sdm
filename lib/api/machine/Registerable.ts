/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { SoftwareDeliveryMachine } from "./SoftwareDeliveryMachine";

export interface Registerable {

    register(sdm: SoftwareDeliveryMachine): void;
}

class RegistrableManager implements Registerable {

    public readonly registerables: Registerable[] = [];
    public sdm: SoftwareDeliveryMachine;

    public addRegisterable(registrable: Registerable): void {
        if (this.sdm) {
            registrable.register(this.sdm);
        } else {
            this.registerables.push(registrable);
        }
    }

    public register(sdm: SoftwareDeliveryMachine): void {
        this.registerables.forEach(r => {
            r.register(sdm);
        });
        this.registerables.splice(0, this.registerables.length);
        this.sdm = sdm;
    }
}

(global as any).__registrable = new RegistrableManager();

export function resetRegistrableManager(): void {
    (global as any).__registrable = new RegistrableManager();
}

export function registrableManager(): Registerable {
    return (global as any).__registrable;
}

export function registerRegistrable(registrable: Registerable): void {
    (registrableManager() as any).addRegisterable(registrable);
}
