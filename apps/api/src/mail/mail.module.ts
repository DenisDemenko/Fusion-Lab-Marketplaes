import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

// Global: mail is a leaf utility with no dependencies of its own, and
// several unrelated features need it. Registering it once avoids threading
// a MailModule import through every feature module that sends a letter.
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
