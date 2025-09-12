import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Agents } from '@prisma/client';
import { CreateWebsiteAgentDto } from 'src/agents/dto/create-website-agent.dto';
import puppeteer from 'puppeteer';
import { N8nService } from 'src/n8n/n8n.service';
import { S3Service } from 'src/aws/s3/s3.service';

@Injectable()
export class IngestionService {
  constructor(
    private readonly s3Service: S3Service,
    private readonly n8nService: N8nService,
  ) {}

  private logger = new Logger(IngestionService.name);

  async processDocumentIngestion(
    data: CreateWebsiteAgentDto,
    organization: string,
    agent: Agents,
    embeddings?: string[],
  ) {
    const documentUrls: string[] = [];
    console.log(data);

    if (data.knowledgeBase.documents) {
      // Upload documents to S3
      try {
        const documentUploads = await Promise.all(
          data.knowledgeBase.documents.map((document: Express.Multer.File) =>
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
          files: data.knowledgeBase.documents,
          agentId: agent.id,
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

  async processPlainTextIngestion(
    data: CreateWebsiteAgentDto,
    organization: string,
    agent: Agents,
    embeddings?: string[],
  ) {
    await this.n8nService.ingestPlainText({
      data: data.knowledgeBase.freeText || '',
      agentId: agent.id,
      organizationId: organization,
      embeddings,
    });
  }

  async processLinksIngestion(
    links: { url: string; isSPA: boolean }[],
    organization: string,
    agent: Agents,
    embeddings?: string[],
  ) {
    console.log('processLinksIngestion', embeddings);
    let browser: any = null;
    for (const link of links) {
      if (link.isSPA) {
        if (!browser) {
          browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
          });
        }
        const page = await browser.newPage();
        console.log('New page created');
        await page.setDefaultTimeout(30000);
        console.log('Set default timeout');
        await page.setUserAgent(
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        );
        try {
          console.log('Going to link:', link);
          await page.goto(link.url, { waitUntil: 'networkidle2' });
          const html = await page.content();
          await browser.close();

          await this.n8nService.ingestLinks({
            html,
            agentId: agent.id,
            organizationId: organization,
            embeddings,
          });
        } catch (error) {
          this.logger.error('Failed to get HTML for link: ' + link.url, error);
          throw new HttpException(
            'Provided link is not a valid URL',
            HttpStatus.BAD_REQUEST,
          );
        }
      } else {
        this.logger.log('Not SPA, skipping puppeteer');
        const resp = await fetch(link.url, {
          method: 'GET',
        });
        const html = await resp.text();
        await this.n8nService.ingestLinks({
          html,
          agentId: agent.id,
          organizationId: organization,
          embeddings,
        });
      }
    }
  }
}
