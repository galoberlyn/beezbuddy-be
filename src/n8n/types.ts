export type DocumentIngestionData = {
  files: Express.Multer.File[];
  agentIds: string[];
  organizationId: string;
  embeddings?: string[];
};

export type PlainTextIngestionData = {
  data: string;
  agentIds: string[];
  organizationId: string;
  embeddings?: string[];
};

export type LinksIngestionData = {
  html: string;
  knowledgeBaseId: string;
  organizationId: string;
  embeddings?: string[];
  agentIds: string[];
};
