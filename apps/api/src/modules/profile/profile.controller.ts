import {
  Controller,
  Get,
  Post,
  Param,
  Res,
  NotFoundException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { CurrentUser, Public } from '../../common/decorators';
import { ProfileService } from './profile.service';

@Controller('profile')
export class ProfileController {
  constructor(private profileService: ProfileService) {}

  @Get()
  getProfile(@CurrentUser() user: any) {
    return this.profileService.getProfile(user.sub);
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  uploadAvatar(
    @CurrentUser() user: any,
    @UploadedFile() file: { originalname: string; buffer: Buffer },
  ) {
    return this.profileService.uploadAvatar(user.sub, file);
  }

  @Get('avatar/:userId')
  @Public()
  async serveAvatar(@Param('userId') userId: string, @Res() res: Response) {
    const avatarPath = await this.profileService.getAvatarPathForUser(userId);
    if (!avatarPath) {
      throw new NotFoundException('No avatar found');
    }
    const filePath = this.profileService.getAvatarFilePath(avatarPath);
    return res.sendFile(filePath);
  }
}
