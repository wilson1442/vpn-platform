import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../common/prisma.service';

@Processor('crl-distribution')
export class CrlWorker extends WorkerHost {
  private readonly logger = new Logger(CrlWorker.name);

  constructor(private prisma: PrismaService) {
    super();
  }

  async process(job: Job<{ crlPem: string; crlVersion: number }>) {
    const { crlPem, crlVersion } = job.data;
    const nodes = await this.prisma.vpnNode.findMany({ where: { isActive: true } });

    for (const node of nodes) {
      try {
        const url = `http://${node.hostname}:${node.agentPort}/crl`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${node.agentToken}`,
          },
          body: JSON.stringify({ crlPem, crlVersion }),
        });
        if (!resp.ok) {
          this.logger.warn(`CRL push to ${node.name} failed: ${resp.status}`);
        } else {
          this.logger.log(`CRL v${crlVersion} pushed to ${node.name}`);
        }
      } catch (err) {
        this.logger.error(`CRL push to ${node.name} error: ${err}`);
      }
    }
  }
}
