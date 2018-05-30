import { Goal } from "../api/goal/Goal";
import { IsolatedGoalLauncher } from "../api/goal/support/IsolatedGoalLauncher";
import {
    GoalFulfillment,
    GoalFullfillmentCallback,
    GoalImplementation,
    GoalSideEffect,
    SdmGoalImplementationMapper,
} from "../api/goal/support/SdmGoalImplementationMapper";
import { PushListenerInvocation } from "../api/listener/PushListener";
import { SdmGoal } from "../ingesters/sdmGoalIngester";

export class SdmGoalImplementationMapperImpl implements SdmGoalImplementationMapper {

    private readonly implementations: GoalImplementation[] = [];
    private readonly sideEffects: GoalSideEffect[] = [];
    private readonly callbacks: GoalFullfillmentCallback[] = [];

    constructor(private readonly goalLauncher: IsolatedGoalLauncher) {
    }

    public findImplementationBySdmGoal(goal: SdmGoal): GoalImplementation {
        const matchedNames = this.implementations.filter(m =>
            m.implementationName === goal.fulfillment.name &&
            m.goal.context === goal.externalKey);
        if (matchedNames.length > 1) {
            throw new Error("Multiple mappings for name " + goal.fulfillment.name);
        }
        if (matchedNames.length === 0) {
            throw new Error("No implementation found with name " + goal.fulfillment.name);
        }
        return matchedNames[0];
    }

    public addImplementation(implementation: GoalImplementation): this {
        this.implementations.push(implementation);
        return this;
    }

    public addSideEffect(sideEffect: GoalSideEffect): this {
        this.sideEffects.push(sideEffect);
        return this;
    }

    public addFullfillmentCallback(callback: GoalFullfillmentCallback): this {
        this.callbacks.push(callback);
        return this;
    }

    public async findFulfillmentByPush(goal: Goal, inv: PushListenerInvocation): Promise<GoalFulfillment | undefined> {
        const implementationsForGoal = this.implementations.filter(m => m.goal.name === goal.name
            && m.goal.environment === goal.environment);
        for (const implementation of implementationsForGoal) {
            if (await implementation.pushTest.mapping(inv)) {
                return implementation;
            }
        }
        const knownSideEffects = this.sideEffects.filter(m => m.goal.name === goal.name
            && m.goal.environment === goal.environment);
        for (const sideEffect of knownSideEffects) {
            if (await sideEffect.pushTest.mapping(inv)) {
                return sideEffect;
            }
        }
        return undefined;
    }

    public findFullfillmentCallbackForGoal(g: SdmGoal): GoalFullfillmentCallback[] {
        return this.callbacks.filter(c =>
            c.goal.name === g.name &&
            // This slice is required because environment is suffixed with /
            (c.goal.definition.environment.slice(0, -1) === g.environment
                || c.goal.definition.environment === g.environment));
    }

    public getIsolatedGoalLauncher(): IsolatedGoalLauncher {
        return this.goalLauncher;
    }
}