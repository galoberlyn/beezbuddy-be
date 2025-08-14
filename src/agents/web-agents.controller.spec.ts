import { Test, TestingModule } from '@nestjs/testing';
import { WebAgentsController } from './web-agents.controller';
import { WebAgentsService } from './web-agents.service';

describe('WebAgentsController', () => {
  let controller: WebAgentsController;
  let service: WebAgentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebAgentsController],
      providers: [
        {
          provide: WebAgentsService,
          useValue: {
            create: jest.fn().mockResolvedValue({ id: 1, agentName: 'test' }),
          },
        },
      ],
    }).compile();

    controller = module.get<WebAgentsController>(WebAgentsController);
    service = module.get<WebAgentsService>(WebAgentsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create an agent with valid multipart form data', () => {
      const mockFormData = {
        agentName: 'Test Agent',
        persona: 'Test Persona',
        'knowledgeBase.freeText': 'Test free text',
        'knowledgeBase.links[0].url': 'https://example.com',
      };

      const mockFiles = [
        {
          fieldname: 'avatar',
          originalname: 'avatar.jpg',
          mimetype: 'image/jpeg',
          buffer: Buffer.from('test'),
        } as Express.Multer.File,
        {
          fieldname: 'knowledgeBase.documents',
          originalname: 'doc1.pdf',
          mimetype: 'application/pdf',
          buffer: Buffer.from('test'),
        } as Express.Multer.File,
      ];

      controller.create(mockFormData, mockFiles);

      expect(service.create).toHaveBeenCalledWith(
        expect.objectContaining({
          agentName: 'Test Agent',
          persona: 'Test Persona',
          knowledgeBase: {
            freeText: 'Test free text',
            links: ['https://example.com'],
            documents: [mockFiles[1]],
          },
          avatar: mockFiles[0],
        }),
      );
    });
  });
});
