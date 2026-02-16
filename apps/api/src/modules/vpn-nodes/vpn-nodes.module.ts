import { Module } from '@nestjs/common';
import { VpnNodesService } from './vpn-nodes.service';
import { VpnNodesController } from './vpn-nodes.controller';
import { NodeInstallerService } from './node-installer.service';
import { PkiModule } from '../pki/pki.module';
import { StatsModule } from '../stats/stats.module';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  imports: [PkiModule, StatsModule, SessionsModule],
  providers: [VpnNodesService, NodeInstallerService],
  controllers: [VpnNodesController],
  exports: [VpnNodesService],
})
export class VpnNodesModule {}
