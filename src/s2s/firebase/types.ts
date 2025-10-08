export type FirebaseUpdateAgents = {
  orgId: string;
  agentIds: string[];
  payload: {
    status: string;
  };
};
