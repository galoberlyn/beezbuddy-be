import { Injectable } from '@nestjs/common';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

@Injectable()
export class LangchainService {
  constructor() {}

  async textToDocs(
    text: string,
    organizationId: string,
    agentId: string,
  ): Promise<Document[]> {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1024,
      chunkOverlap: 100,
    });
    const chunks = await splitter.createDocuments([text]);
    return chunks.map((doc, idx) => {
      doc.metadata = {
        ...doc.metadata,
        id: uuidv4(),
        chunk: idx,
        organization_id: organizationId,
        source: 'freetext',
        type: 'text',
        agent_id: agentId,
      };
      return doc;
    });
  }

  async fileToDocs(
    file: Express.Multer.File,
    organizationId: string,
    agentId: string,
  ): Promise<Document[]> {
    // Validate file type
    if (!this.isSupportedFileType(file.originalname)) {
      throw new Error(
        `Unsupported file type: ${file.originalname}. Supported types: .txt, .pdf, .doc, .docx, .csv, .json`,
      );
    }

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1024,
      chunkOverlap: 100,
    });

    let textContent: string;
    const fileExtension = path.extname(file.originalname).toLowerCase();

    // Extract text content based on file type
    if (fileExtension === '.txt') {
      textContent = file.buffer.toString('utf-8');
    } else if (fileExtension === '.pdf') {
      // For PDFs, we'll need to use a PDF parser
      // For now, we'll extract text from buffer if possible
      textContent = file.buffer.toString('utf-8');
      // TODO: Implement proper PDF text extraction using pdf-parse or similar
      // Note: This is a basic fallback and may not work for all PDFs
    } else if (fileExtension === '.doc' || fileExtension === '.docx') {
      // For Word documents, we'll need to use a doc parser
      // For now, we'll extract text from buffer if possible
      textContent = file.buffer.toString('utf-8');
      // TODO: Implement proper Word document text extraction using mammoth or similar
      // Note: This is a basic fallback and may not work for all Word documents
    } else if (fileExtension === '.csv') {
      // For CSV files, convert to text
      textContent = file.buffer.toString('utf-8');
    } else if (fileExtension === '.json') {
      // For JSON files, extract text content
      try {
        const jsonContent = JSON.parse(file.buffer.toString('utf-8'));
        textContent = JSON.stringify(jsonContent, null, 2);
      } catch (error) {
        console.log(error);
        textContent = file.buffer.toString('utf-8');
      }
    } else {
      // For other file types, try to extract text from buffer
      textContent = file.buffer.toString('utf-8');
    }

    if (!textContent || textContent.trim().length === 0) {
      throw new Error(
        `Could not extract text content from file: ${file.originalname}. File may be binary or unsupported format.`,
      );
    }

    // Clean up the text content
    textContent = textContent.trim();

    const chunks = await splitter.createDocuments([textContent]);
    return chunks.map((doc, idx) => {
      doc.metadata = {
        ...doc.metadata,
        id: uuidv4(),
        chunk: idx,
        organization_id: organizationId,
        source: 'document',
        type: 'document',
        agent_id: agentId,
        filename: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        fileExtension: fileExtension,
        totalChunks: chunks.length,
      };
      return doc;
    });
  }

  private isSupportedFileType(filename: string): boolean {
    const supportedExtensions = [
      '.txt',
      '.pdf',
      '.doc',
      '.docx',
      '.csv',
      '.json',
    ];
    const fileExtension = path.extname(filename).toLowerCase();
    return supportedExtensions.includes(fileExtension);
  }

  // async processDocumentFromS3(
  //   s3Url: string,
  //   filename: string,
  //   organizationId: string,
  //   agentId: string,
  // ): Promise<Document[]> {
  //   // Validate file type
  //   if (!this.isSupportedFileType(filename)) {
  //     throw new Error(
  //       `Unsupported file type: ${filename}. Supported types: .txt, .pdf, .doc, .docx, .csv, .json`,
  //     );
  //   }

  //   const splitter = new RecursiveCharacterTextSplitter({
  //     chunkSize: 1024,
  //     chunkOverlap: 100,
  //   });

  //   // TODO: Implement S3 file download and processing
  //   // This would require AWS SDK integration to download the file content
  //   // For now, we'll throw an error indicating this needs to be implemented
  //   throw new Error(
  //     'S3 document processing not yet implemented. Please implement AWS SDK integration to download and process S3 files.',
  //   );
  // }
}
