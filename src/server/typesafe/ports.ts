import type {
  Questions,
  SystemOneRequest,
  SystemOneResult,
} from "@typesafe-ai/sdk";

export type SystemOneInvoker = {
  systemOne<Q extends Questions>(
    request: SystemOneRequest<Q>,
  ): Promise<SystemOneResult<Q>>;
};
