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

import { Fingerprint } from "@atomist/automation-client/project/fingerprint/Fingerprint";
import { GitProject } from "@atomist/automation-client/project/git/GitProject";
import { dependenciesFingerprintsFromParsedPom } from "./dependenciesFingerprintsFromParsedPom";
import { extractEffectivePom } from "./effectivePomExtractor";

/**
 * Public entry point for all Maven fingerprints. Use mvn help:effective-pom
 * to generic effective POM then parse it and turn it into fingerprints.
 * @param {GitProject} p
 * @return {Promise<Fingerprint[]>}
 */
export async function mavenFingerprinter(p: GitProject): Promise<Fingerprint[]> {
    try {
        await p.findFile("pom.xml");
        const epom = await extractEffectivePom(p);
        return Promise.all([
            dependenciesFingerprintsFromParsedPom,
            // TODO add other Maven POM fingerprints
        ].map(fp => fp(epom)));
    } catch {
        // If we can't find a pom, just exit
        return [];
    }
}
