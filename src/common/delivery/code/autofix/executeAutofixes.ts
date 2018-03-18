import { HandlerContext, logger } from "@atomist/automation-client";
import { GitHubRepoRef } from "@atomist/automation-client/operations/common/GitHubRepoRef";
import { ProjectOperationCredentials } from "@atomist/automation-client/operations/common/ProjectOperationCredentials";
import { BranchCommit } from "@atomist/automation-client/operations/edit/editModes";
import { ProjectEditor } from "@atomist/automation-client/operations/edit/projectEditor";
import { chainEditors } from "@atomist/automation-client/operations/edit/projectEditorOps";
import { editRepo } from "@atomist/automation-client/operations/support/editorUtils";
import { GitCommandGitProject } from "@atomist/automation-client/project/git/GitCommandGitProject";
import { OnAnyPendingStatus } from "../../../../typings/types";
import { PushTestInvocation } from "../../../listener/GoalSetter";
import { addressChannelsFor, messageDestinationsFor } from "../../../slack/addressChannels";
import { teachToRespondInEventHandler } from "../../../slack/contextMessageRouting";
import { AutofixRegistration, relevantCodeActions } from "../codeActionRegistrations";

export type CommitShape = OnAnyPendingStatus.Commit;

/**
 * Execute autofixes against this push
 * Throw an error on failure
 * @param {CommitShape} commit
 * @param {HandlerContext} context
 * @param {ProjectOperationCredentials} credentials
 * @param {AutofixRegistration[]} registrations
 * @return {Promise<void>}
 */
export async function executeAutofixes(
                                       commit: CommitShape,
                                       context: HandlerContext,
                                       credentials: ProjectOperationCredentials,
                                       registrations: AutofixRegistration[]) {
    if (registrations.length > 0) {
        const push = commit.pushes[0];
        const editableRepoRef = new GitHubRepoRef(commit.repo.owner, commit.repo.name, push.branch);
        const project = await GitCommandGitProject.cloned(credentials, editableRepoRef);
        const pti: PushTestInvocation = {
            id: editableRepoRef,
            project,
            credentials,
            context,
            addressChannels: addressChannelsFor(commit.repo, context),
            push,
        };
        const editors = await relevantCodeActions<AutofixRegistration>(registrations, pti);
        logger.info("Will apply %d eligible autofixes to %j", editors.length, pti.id);
        const singleEditor: ProjectEditor = editors.length > 0 ? chainEditors(...editors.map(e => e.action)) : undefined;
        if (!!singleEditor) {
            const editMode: BranchCommit = {
                branch: pti.push.branch,
                message: `Autofixes (${editors.map(e => e.name).join()})\n\n[atomist]`,
            };
            logger.info("Editing %s with mode=%j", pti.id.url, editMode);
            await editRepo(teachToRespondInEventHandler(context, messageDestinationsFor(commit.repo, context)),
                pti.project, singleEditor, editMode);
        }
    }
}
