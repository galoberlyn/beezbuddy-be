import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Agents } from '@prisma/client';
import puppeteer, { Browser, Page } from 'puppeteer';
import { N8nService } from 'src/n8n/n8n.service';
import { S3Service } from 'src/aws/s3/s3.service';
import { CreateKnowledgeBaseDto } from 'src/knowledge-bases/create-kb.dto';
/**
 * @TODO batch job? para di overloaded si n8n
 */
@Injectable()
export class IngestionService {
  constructor(
    private readonly s3Service: S3Service,
    private readonly n8nService: N8nService,
  ) {}

  private logger = new Logger(IngestionService.name);

  async processDocumentIngestion(
    data: CreateKnowledgeBaseDto,
    organization: string,
    agents: Agents[],
    embeddings?: string[],
  ) {
    const documentUrls: string[] = [];

    if (data.documents) {
      try {
        const documentUploads = await Promise.all(
          data.documents.map((document: Express.Multer.File) =>
            this.s3Service.uploadFile(
              document,
              organization,
              `${organization}/documents/`,
            ),
          ),
        );
        if (documentUploads) {
          documentUrls.push(...documentUploads);
        }
      } catch (error) {
        this.logger.error('Failed to upload documents to S3:', error);
        throw error;
      }

      try {
        await this.n8nService.ingestDocument({
          files: data.documents,
          agentIds: agents.map(agent => agent.id),
          organizationId: organization,
          embeddings,
        });
        return documentUrls;
      } catch (error) {
        this.logger.error('Failed to ingest documents:', error);
        throw error;
      }
    }
  }

  // TODO same with website agents
  async processPlainTextIngestion(
    data: CreateKnowledgeBaseDto,
    organization: string,
    agents: Agents[],
    embeddings?: string[],
  ) {
    await this.n8nService.ingestPlainText({
      data: data.freeText || '',
      agentIds: agents.map(agent => agent.id),
      organizationId: organization,
      embeddings,
    });
  }

  async processLinksIngestion(
    links: { url: string; isSPA: boolean }[],
    organization: string,
    agents: Agents[],
    knowledgeBaseId: string,
    embeddings?: string[],
  ) {
    let browser: Browser | null = null;

    try {
      // Launch only if at least one SPA link exists
      const hasSPA = links.some(l => l.isSPA);
      if (hasSPA) {
        browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
      }

      for (const link of links) {
        if (link.isSPA) {
          if (!browser) {
            throw new Error('Puppeteer browser not initialized');
          }
          let page: Page | null = null;
          try {
            page = await browser.newPage();
            page.setDefaultTimeout(30_000);
            await page.setUserAgent(
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            );
            await page.goto(link.url, {
              waitUntil: 'networkidle0',
              timeout: 30_000,
            });
            const html = await page.content();

            await this.n8nService.ingestLinks({
              html,
              knowledgeBaseId,
              organizationId: organization,
              embeddings,
              agentIds: agents.map(agent => agent.id),
            });
          } catch (error) {
            this.logger.error(
              `Failed to get HTML for link: ${link.url}`,
              error,
            );
            throw new HttpException(
              'Provided link is not a valid URL',
              HttpStatus.BAD_REQUEST,
            );
          } finally {
            if (page) {
              try {
                await page.close();
              } catch {
                this.logger.error('Failed to close page');
              }
            }
          }
        } else {
          this.logger.log('Not SPA, skipping puppeteer');
          const resp = await fetch(link.url, { method: 'GET' });
          const html = await resp.text();
          await this.n8nService.ingestLinks({
            html,
            knowledgeBaseId: knowledgeBaseId,
            organizationId: organization,
            embeddings,
            agentIds: agents.map(agent => agent.id),
          });
        }
      }
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch {
          this.logger.error('Failed to close browser');
        }
        browser = null; // ensure we don't reuse a closed instance
      }
    }
  }
}
