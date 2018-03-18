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

import { onAnyPush, whenPushSatisfies } from "../blueprint/ruleDsl";
import { SoftwareDeliveryMachine } from "../blueprint/SoftwareDeliveryMachine";
import { MavenBuilder } from "../common/delivery/build/local/maven/MavenBuilder";
import { NpmBuilder } from "../common/delivery/build/local/npm/NpmBuilder";
import { NoGoals } from "../common/delivery/goals/common/commonGoals";
import { HttpServiceGoals, LocalDeploymentGoals } from "../common/delivery/goals/common/httpServiceGoals";
import { LibraryGoals } from "../common/delivery/goals/common/libraryGoals";
import { NpmBuildGoals } from "../common/delivery/goals/common/npmGoals";
import { HasCloudFoundryManifest } from "../common/listener/support/cloudFoundryManifestPushTest";
import { HasSpringBootApplicationClass, IsMaven } from "../common/listener/support/jvmPushTests";
import { MaterialChangeToJavaRepo } from "../common/listener/support/materialChangeToJavaRepo";
import { NamedSeedRepo } from "../common/listener/support/NamedSeedRepo";
import { IsNode } from "../common/listener/support/nodeGuards";
import { FromAtomist, ToDefaultBranch, ToPublicRepo } from "../common/listener/support/pushTests";
import { not } from "../common/listener/support/pushTestUtils";
import { createEphemeralProgressLog } from "../common/log/EphemeralProgressLog";
import { lookFor200OnEndpointRootGet } from "../common/verify/lookFor200OnEndpointRootGet";
import { DefaultArtifactStore } from "./blueprint/artifactStore";
import { CloudFoundryProductionDeployOnSuccessStatus } from "./blueprint/deploy/cloudFoundryDeploy";
import { LocalExecutableJarDeploy } from "./blueprint/deploy/localSpringBootDeployOnSuccessStatus";
import { suggestAddingCloudFoundryManifest } from "./blueprint/repo/suggestAddingCloudFoundryManifest";
import { addCloudFoundryManifest } from "./commands/editors/pcf/addCloudFoundryManifest";
import { addDemoEditors } from "./demoEditors";
import { addNodeSupport } from "./nodeSupport";
import { addSpringSupport } from "./springSupport";
import { addTeamPolicies } from "./teamPolicies";

export function cloudFoundrySoftwareDeliveryMachine(opts: { useCheckstyle: boolean }): SoftwareDeliveryMachine {
    const sdm = new SoftwareDeliveryMachine(
        {
            deployers: [
                LocalExecutableJarDeploy,
                CloudFoundryProductionDeployOnSuccessStatus,
            ],
            artifactStore: DefaultArtifactStore,
        },
        whenPushSatisfies(IsMaven, HasSpringBootApplicationClass, not(FromAtomist), not(MaterialChangeToJavaRepo))
            .itMeans("No material change to Java")
            .setGoals(NoGoals),
        whenPushSatisfies(ToDefaultBranch, IsMaven, HasSpringBootApplicationClass, HasCloudFoundryManifest,
            ToPublicRepo, not(NamedSeedRepo))
            .itMeans("Spring Boot service to deploy")
            .setGoals(HttpServiceGoals),
        whenPushSatisfies(IsMaven, HasSpringBootApplicationClass, not(FromAtomist))
            .itMeans("Spring Boot service local deploy")
            .setGoals(LocalDeploymentGoals),
        whenPushSatisfies(IsMaven, MaterialChangeToJavaRepo)
            .itMeans("Build Java")
            .setGoals(LibraryGoals),
        whenPushSatisfies(IsNode)
            .itMeans("Build with npm")
            .setGoals(NpmBuildGoals)
            .buildWith(new NpmBuilder(DefaultArtifactStore, createEphemeralProgressLog)),
        onAnyPush.buildWith(new MavenBuilder(DefaultArtifactStore, createEphemeralProgressLog)),
    );

    sdm.addNewRepoWithCodeActions(suggestAddingCloudFoundryManifest)
        .addSupportingCommands(
            () => addCloudFoundryManifest,
        )
        .addEndpointVerificationListeners(lookFor200OnEndpointRootGet());

    addSpringSupport(sdm, opts);
    addNodeSupport(sdm);
    addTeamPolicies(sdm);

    addDemoEditors(sdm);
    return sdm;
}
