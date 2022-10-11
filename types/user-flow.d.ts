import {UserFlow as UserFlow_} from '../core/user-flow';

declare module UserFlow {
  export interface FlowArtifacts {
    gatherSteps: GatherStep[];
    name?: string;
  }

  export interface GatherStep {
    artifacts: LH.Artifacts;
    name: string;
    config?: LH.Config.Json;
    flags?: LH.Flags;
  }
}

type UserFlow = InstanceType<typeof UserFlow_>;

export default UserFlow;
