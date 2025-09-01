import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { RoleModule } from './roles/role.module';
import { UsersModule } from './auth/users/users.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './auth/organizations/organizations.module';
import { ConfigModule } from '@nestjs/config';
import { WebAgentsModule } from './agents/web-agents.module';
import { S3Module } from './aws/s3/s3.module';
import { LangchainModule } from './langchain/langchain.module';
import { QueryModule } from './query/query.module';
import { ConversationModule } from './conversations/conversations.module';
import { EmbeddingModule } from './embeddings/embedding.module';
import { WebChatModule } from './public/web-chat/web-chat.module';
import { N8nModule } from './n8n/n8n.module';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule.forRoot(),
    UsersModule,
    AuthModule,
    OrganizationsModule,
    RoleModule,
    WebAgentsModule,
    S3Module,
    LangchainModule,
    QueryModule,
    ConversationModule,
    EmbeddingModule,
    WebChatModule,
    N8nModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
