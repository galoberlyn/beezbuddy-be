export type DocumentIngestionData = {
  files: Express.Multer.File[];
  agentId: string;
  organizationId: string;
};

export type PlainTextIngestionData = {
  data: string;
  agentId: string;
  organizationId: string;
};

export type LinksIngestionData = {
  html: string;
  agentId: string;
  organizationId: string;
};
