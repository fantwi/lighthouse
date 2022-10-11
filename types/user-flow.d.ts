import {UserFlow as UserFlow_} from '../core/user-flow';

declare module UserFlow {
  export interface FlowArtifacts {
    gatherSteps: GatherStep[];
    name?: string;
  }

  export interface Options {
    config: LH.Config.Json;
    name?: string;
  }

  export interface StepFlags extends LH.Flags {
    name?: string;
  }

  export interface GatherStep {
    artifacts: LH.Artifacts;
    flags?: StepFlags;
  }
}

type UserFlow = typeof UserFlow_;

export default UserFlow;
