import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FirebaseAuthGuard } from './auth/firebase-auth.guard';
import { UsersService } from './users/users.service';

describe('AppController', () => {
  let appController: AppController;

  const usersService = { findById: jest.fn() };

  beforeEach(async () => {
    usersService.findById.mockReset();

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        // The real UsersService needs Postgres; this controller asks it one
        // question, so the answer is stubbed here and the wiring is covered
        // end to end in test/*.e2e-spec.ts.
        { provide: UsersService, useValue: usersService },
      ],
    })
      // FirebaseAuthGuard (used on GET /me) needs a real token verifier —
      // irrelevant to a controller unit test.
      .overrideGuard(FirebaseAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('GET /me', () => {
    const user = {
      id: 'user-1',
      firebaseUid: 'uid-1',
      email: 'seller@example.com',
      role: 'seller' as const,
    };

    it('reports the seller profile when there is one', async () => {
      usersService.findById.mockResolvedValue({
        displayName: 'Майстерня',
        sellerProfile: {
          id: 'seller-1',
          slug: 'maisternia',
          displayName: 'Майстерня',
          status: 'approved',
        },
      });

      await expect(appController.getMe(user)).resolves.toMatchObject({
        role: 'seller',
        seller: { slug: 'maisternia', status: 'approved' },
      });
    });

    // A buyer has no seller profile, and the frontend decides whether to
    // show the seller cabinet from exactly this field.
    it('returns a null seller for an account that never applied', async () => {
      usersService.findById.mockResolvedValue({
        displayName: null,
        sellerProfile: null,
      });

      await expect(appController.getMe(user)).resolves.toMatchObject({
        seller: null,
        displayName: null,
      });
    });
  });
});
