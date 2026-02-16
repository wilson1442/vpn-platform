import { Module } from '@nestjs/common';
import { EmailTemplatesService } from './email-templates.service';
import { EmailTemplatesController } from './email-templates.controller';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  providers: [EmailTemplatesService],
  controllers: [EmailTemplatesController],
  exports: [EmailTemplatesService],
})
export class EmailTemplatesModule {}
