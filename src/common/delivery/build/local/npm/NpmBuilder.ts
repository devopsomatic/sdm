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

import { logger } from "@atomist/automation-client";
import { ProjectOperationCredentials } from "@atomist/automation-client/operations/common/ProjectOperationCredentials";
import { RemoteRepoRef } from "@atomist/automation-client/operations/common/RepoId";
import { ArtifactStore } from "../../../../../spi/artifact/ArtifactStore";
import { AppInfo } from "../../../../../spi/deploy/Deployment";
import { LogInterpretation, LogInterpreter } from "../../../../../spi/log/InterpretedLog";
import { LogFactory, ProgressLog } from "../../../../../spi/log/ProgressLog";
import {
    asSpawnCommand, ChildProcessResult, spawnAndWatch, SpawnCommand,
    stringifySpawnCommand,
} from "../../../../../util/misc/spawned";
import { ProjectLoader } from "../../../../repo/ProjectLoader";
import { LocalBuilder, LocalBuildInProgress } from "../LocalBuilder";

export const Install: SpawnCommand = asSpawnCommand("npm install");

export const RunBuild: SpawnCommand = asSpawnCommand("npm run build");

export const RunCompile: SpawnCommand = asSpawnCommand("npm run compile");

/**
 * Build with npm in the local automation client.
 * Note it is NOT intended for use for multiple organizations. It's OK
 * for one organization to use inside its firewall, but there is potential
 * vulnerability in builds of unrelated tenants getting at each others
 * artifacts.
 */
export class NpmBuilder extends LocalBuilder implements LogInterpretation {

    private readonly buildCommands: SpawnCommand[];

    constructor(artifactStore: ArtifactStore,
                logFactory: LogFactory,
                projectLoader: ProjectLoader,
                buildCommand1: SpawnCommand = RunBuild,
                ...additionalCommands: SpawnCommand[]) {
        super("NpmBuilder", artifactStore, logFactory, projectLoader);
        this.buildCommands = [Install, buildCommand1].concat(additionalCommands);
    }

    protected async startBuild(credentials: ProjectOperationCredentials,
                               id: RemoteRepoRef,
                               team: string,
                               log: ProgressLog): Promise<LocalBuildInProgress> {
        logger.info("NpmBuilder.startBuild on %s, buildCommands=[%j]", id.url, this.buildCommands);
        return this.projectLoader.doWithProject({credentials, id, readOnly: true}, async p => {
            // Find the artifact info from package.json
            const packageJson = await p.findFile("package.json");
            const content = await packageJson.getContent();
            const pkg = JSON.parse(content);
            const appId: AppInfo = {id, name: pkg.name, version: pkg.version};
            const opts = {
                cwd: p.baseDir,
            };

            try {
                const errorFinder = (code, signal, l) => {
                    return l.log.startsWith("[error]") || l.log.includes("ERR!");
                };
                let buildResult: ChildProcessResult;
                for (const buildCommand of this.buildCommands) {
                    buildResult = await spawnAndWatch(buildCommand, opts, log,
                        {
                            errorFinder,
                            stripAnsi: true,
                        });
                    if (buildResult.error) {
                        logger.info("Stopping build commands due to error on %s", stringifySpawnCommand(buildCommand));
                        break;
                    }
                }
                const b = new NpmBuild(appId, id, buildResult, team, log.url);
                logger.info("Build RETURN: %j", b.buildResultAchieved);
                return b;
            } catch {
                const b = new NpmBuild(appId, id, ({error: true, code: 1}), team, log.url);
                logger.info("Build FAILURE: %j", b.buildResultAchieved);
                return b;
            }
        });
    }

    public logInterpreter: LogInterpreter = log => {
        const relevantPart = log.split("\n")
            .filter(l => l.startsWith("ERROR") || l.includes("ERR!"))
            .join("\n");
        return {
            relevantPart,
            message: "npm errors",
            includeFullLog: true,
        };
    }

}

class NpmBuild implements LocalBuildInProgress {

    public readonly buildResult: Promise<ChildProcessResult>;

    constructor(public appInfo: AppInfo,
                public repoRef: RemoteRepoRef,
                public buildResultAchieved: ChildProcessResult,
                public team: string,
                public url: string) {
        this.buildResult = Promise.resolve(buildResultAchieved);
    }

    public deploymentUnitFile: string;

}
