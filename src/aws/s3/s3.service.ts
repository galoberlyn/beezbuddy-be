import { Injectable, Logger } from '@nestjs/common';
import * as AWS from 'aws-sdk';

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
});

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3: AWS.S3 = new AWS.S3();
  private readonly bucketName = process.env.AWS_S3_BUCKET_NAME;

  async uploadFile(
    file: Express.Multer.File,
    organizationId: string,
    folderPath: string,
  ) {
    if (!this.bucketName) {
      throw new Error('AWS_S3_BUCKET_NAME environment variable is not set');
    }

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      throw new Error('AWS credentials are not properly configured');
    }

    try {
      const key = `${organizationId}/${folderPath}${file.originalname}`;

      const uploadResult = await this.s3
        .upload({
          Bucket: this.bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        })
        .promise();

      this.logger.log(
        `File uploaded successfully to bucket ${this.bucketName}: ${uploadResult.Location}`,
      );
      return uploadResult.Location;
    } catch (error) {
      this.logger.error(
        `Failed to upload file to S3 bucket ${this.bucketName}`,
        error,
      );
      throw error;
    }
  }
}
