import { logger } from "@atomist/automation-client";
import { SoftwareDeliveryMachine } from "../blueprint/SoftwareDeliveryMachine";
import { HasCloudFoundryManifest } from "../common/listener/support/cloudFoundryManifestPushTest";
import { GuardedPhaseCreator } from "../common/listener/support/GuardedPhaseCreator";
import { IsMaven, IsSpringBoot } from "../common/listener/support/jvmGuards";
import { MaterialChangeToJavaRepo } from "../common/listener/support/materialChangeToJavaRepo";
import { IsNode } from "../common/listener/support/nodeGuards";
import { PushesToDefaultBranch, PushToPublicRepo } from "../common/listener/support/pushTests";
import { DeployFromLocalOnPendingLocalDeployStatus } from "../handlers/events/delivery/deploy/DeployFromLocalOnPendingLocalDeployStatus";
import {
    HttpServicePhases,
    LocalDeploymentPhase,
    LocalDeploymentPhases,
    LocalEndpointPhase,
} from "../handlers/events/delivery/phases/httpServicePhases";
import { LibraryPhases } from "../handlers/events/delivery/phases/libraryPhases";
import { NpmPhases } from "../handlers/events/delivery/phases/npmPhases";
import { LocalBuildOnSuccessStatus } from "./blueprint/build/localBuildOnScanSuccessStatus";
import { CloudFoundryProductionDeployOnSuccessStatus } from "./blueprint/deploy/cloudFoundryDeploy";
import {
    LocalExecutableJarDeployOnSuccessStatus,
    MavenDeployer,
} from "./blueprint/deploy/localSpringBootDeployOnSuccessStatus";
import { suggestAddingCloudFoundryManifest } from "./blueprint/repo/suggestAddingCloudFoundryManifest";
import { addCloudFoundryManifest } from "./commands/editors/pcf/addCloudFoundryManifest";
import { configureSpringSdm } from "./springSdmConfig";

const LocalExecutableJarDeployer = LocalExecutableJarDeployOnSuccessStatus;

export function cloudFoundrySoftwareDeliveryMachine(opts: { useCheckstyle: boolean }): SoftwareDeliveryMachine {
    const sdm = new SoftwareDeliveryMachine(
        {
            builder: LocalBuildOnSuccessStatus,
            // CloudFoundryStagingDeployOnSuccessStatus;
            deployers: [
                () => LocalExecutableJarDeployer,
                CloudFoundryProductionDeployOnSuccessStatus,
            ],
        },
        new GuardedPhaseCreator(HttpServicePhases, PushesToDefaultBranch, IsMaven, IsSpringBoot,
            HasCloudFoundryManifest,
            PushToPublicRepo, MaterialChangeToJavaRepo),
        new GuardedPhaseCreator(LocalDeploymentPhases, IsMaven, IsSpringBoot, MaterialChangeToJavaRepo),
        new GuardedPhaseCreator(LibraryPhases, IsMaven, MaterialChangeToJavaRepo),
        new GuardedPhaseCreator(NpmPhases, IsNode),
    );
    sdm.addNewRepoWithCodeActions(suggestAddingCloudFoundryManifest);
    sdm.addSupportingCommands(
        () => addCloudFoundryManifest,
    )
        .addSupersededListeners(
            inv => {
                logger.info("Will undeploy application %j", inv.id);
                return LocalExecutableJarDeployer.deployer.undeploy(inv.id);
            });
    configureSpringSdm(sdm, opts);
    return sdm;
}
