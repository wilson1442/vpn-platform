import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as forge from 'node-forge';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, mkdtemp, readFile, rmdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { PrismaService } from '../../common/prisma.service';
import { encryptAesGcm, decryptAesGcm } from '../../common/crypto.util';
import { getResellerSubtreeIds } from '../../common/reseller-scope.util';

const execFileAsync = promisify(execFile);

@Injectable()
export class PkiService {
  private readonly logger = new Logger(PkiService.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue('crl-distribution') private crlQueue: Queue,
  ) {}

  async initCA() {
    const existing = await this.prisma.certificateAuthority.findFirst();
    if (existing) throw new BadRequestException('CA already initialized');

    const keys = forge.pki.rsa.generateKeyPair(4096);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);

    const attrs = [
      { name: 'commonName', value: 'VPN Platform CA' },
      { name: 'organizationName', value: 'VPN Platform' },
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.setExtensions([
      { name: 'basicConstraints', cA: true },
      { name: 'keyUsage', keyCertSign: true, cRLSign: true },
    ]);
    cert.sign(keys.privateKey, forge.md.sha256.create());

    const caCertPem = forge.pki.certificateToPem(cert);
    const caKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
    const caKeyEncrypted = encryptAesGcm(caKeyPem);

    const crlPem = await this.generateCrlWithOpenSSL(caCertPem, caKeyPem, []);

    return this.prisma.certificateAuthority.create({
      data: { caCertPem, caKeyEncrypted, crlPem, crlVersion: 1, serialCounter: 2 },
    });
  }

  async issueCert(userId: string, commonName: string, actor?: { sub: string; role: string }) {
    if (actor) await this.assertUserScope(actor, userId);
    const ca = await this.getCA();
    const caCert = forge.pki.certificateFromPem(ca.caCertPem);
    const caKey = forge.pki.privateKeyFromPem(decryptAesGcm(ca.caKeyEncrypted));

    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = ca.serialCounter.toString(16).padStart(2, '0');
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 2);

    cert.setSubject([{ name: 'commonName', value: commonName }]);
    cert.setIssuer(caCert.subject.attributes);
    cert.setExtensions([
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', clientAuth: true },
    ]);
    cert.sign(caKey, forge.md.sha256.create());

    const certPem = forge.pki.certificateToPem(cert);
    const keyPem = forge.pki.privateKeyToPem(keys.privateKey);
    const keyEncrypted = encryptAesGcm(keyPem);

    await this.prisma.certificateAuthority.update({
      where: { id: ca.id },
      data: { serialCounter: ca.serialCounter + 1 },
    });

    return this.prisma.certificate.create({
      data: {
        userId,
        commonName,
        certPem,
        keyEncrypted,
        serialNumber: cert.serialNumber,
      },
    });
  }

  async issueServerCert(commonName: string): Promise<{ certPem: string; keyPem: string }> {
    const ca = await this.getCA();
    const caCert = forge.pki.certificateFromPem(ca.caCertPem);
    const caKey = forge.pki.privateKeyFromPem(decryptAesGcm(ca.caKeyEncrypted));

    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = ca.serialCounter.toString(16).padStart(2, '0');
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 2);

    cert.setSubject([{ name: 'commonName', value: commonName }]);
    cert.setIssuer(caCert.subject.attributes);
    cert.setExtensions([
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true },
    ]);
    cert.sign(caKey, forge.md.sha256.create());

    const certPem = forge.pki.certificateToPem(cert);
    const keyPem = forge.pki.privateKeyToPem(keys.privateKey);

    await this.prisma.certificateAuthority.update({
      where: { id: ca.id },
      data: { serialCounter: ca.serialCounter + 1 },
    });

    return { certPem, keyPem };
  }

  async revokeCert(certId: string, actor?: { sub: string; role: string }) {
    const certRecord = await this.prisma.certificate.findUnique({
      where: { id: certId },
      include: { user: { select: { resellerId: true } } },
    });
    if (!certRecord) throw new NotFoundException('Certificate not found');
    if (certRecord.revokedAt) throw new BadRequestException('Certificate already revoked');
    if (actor) await this.assertResellerId(actor, certRecord.user.resellerId);

    await this.prisma.certificate.update({
      where: { id: certId },
      data: { revokedAt: new Date() },
    });

    await this.regenerateCRL();
    return { revoked: true };
  }

  async regenerateCRL() {
    const ca = await this.getCA();
    const caKeyPem = decryptAesGcm(ca.caKeyEncrypted);

    const revokedCerts = await this.prisma.certificate.findMany({
      where: { revokedAt: { not: null } },
    });

    const crlPem = await this.generateCrlWithOpenSSL(
      ca.caCertPem,
      caKeyPem,
      revokedCerts.map((rc) => ({
        serialNumber: rc.serialNumber,
        revocationDate: rc.revokedAt!,
      })),
    );

    const newVersion = ca.crlVersion + 1;

    await this.prisma.certificateAuthority.update({
      where: { id: ca.id },
      data: { crlPem, crlVersion: newVersion },
    });

    // Distribute CRL to all nodes
    await this.crlQueue.add('distribute-crl', { crlPem, crlVersion: newVersion });

    return { crlVersion: newVersion };
  }

  async getCA() {
    const ca = await this.prisma.certificateAuthority.findFirst();
    if (!ca) throw new BadRequestException('CA not initialized. Call POST /pki/ca/init first.');
    return ca;
  }

  async getCRL() {
    const ca = await this.getCA();
    return { crlPem: ca.crlPem, crlVersion: ca.crlVersion };
  }

  async buildOvpnConfig(certId: string, nodeHostname: string, nodePort: number) {
    const certRecord = await this.prisma.certificate.findUnique({ where: { id: certId } });
    if (!certRecord) throw new NotFoundException('Certificate not found');

    const ca = await this.getCA();
    const clientKey = decryptAesGcm(certRecord.keyEncrypted);

    return `client
dev tun
proto udp
remote ${nodeHostname} ${nodePort}
resolv-retry infinite
nobind
persist-key
persist-tun
remote-cert-tls server
cipher AES-256-GCM
auth SHA256
verb 3

<ca>
${ca.caCertPem.trim()}
</ca>

<cert>
${certRecord.certPem.trim()}
</cert>

<key>
${clientKey.trim()}
</key>
`;
  }

  private async assertUserScope(actor: { sub: string; role: string }, userId: string) {
    if (actor.role === 'ADMIN') return;
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { resellerId: true } });
    if (!user) throw new NotFoundException('User not found');
    await this.assertResellerId(actor, user.resellerId);
  }

  private async assertResellerId(actor: { sub: string; role: string }, targetResellerId: string | null) {
    if (actor.role === 'ADMIN') return;
    const reseller = await this.prisma.reseller.findUnique({ where: { userId: actor.sub } });
    if (!reseller) throw new ForbiddenException();
    if (!targetResellerId) throw new ForbiddenException();
    const subtreeIds = await getResellerSubtreeIds(this.prisma, reseller.id);
    if (!subtreeIds.includes(targetResellerId)) throw new ForbiddenException();
  }

  /**
   * Generate a CRL using the OpenSSL CLI.
   * node-forge does not support CRL creation, so we shell out to openssl.
   */
  private async generateCrlWithOpenSSL(
    caCertPem: string,
    caKeyPem: string,
    revokedCerts: { serialNumber: string; revocationDate: Date }[],
  ): Promise<string> {
    const tmpDir = await mkdtemp(join(tmpdir(), 'vpn-crl-'));
    const caCertPath = join(tmpDir, 'ca.crt');
    const caKeyPath = join(tmpDir, 'ca.key');
    const crlPath = join(tmpDir, 'crl.pem');
    const indexPath = join(tmpDir, 'index.txt');
    const serialPath = join(tmpDir, 'crlnumber');
    const opensslCnfPath = join(tmpDir, 'openssl.cnf');

    try {
      await writeFile(caCertPath, caCertPem, { mode: 0o600 });
      await writeFile(caKeyPath, caKeyPem, { mode: 0o600 });

      // Build index.txt (OpenSSL CA database format)
      // Revoked entry format: R\t<expiry>\t<revocation_date>\t<serial>\tunknown\t<DN>
      const indexLines = revokedCerts.map((rc) => {
        const revokeDate = this.formatOpenSSLDate(rc.revocationDate);
        const serial = rc.serialNumber.toUpperCase().padStart(2, '0');
        return `R\t250101000000Z\t${revokeDate}\t${serial}\tunknown\t/CN=revoked`;
      });
      await writeFile(indexPath, indexLines.join('\n') + (indexLines.length ? '\n' : ''));

      await writeFile(serialPath, '01\n');

      // Minimal openssl.cnf for CRL generation
      const opensslCnf = `
[ca]
default_ca = CA_default

[CA_default]
database = ${indexPath}
crlnumber = ${serialPath}
default_md = sha256
default_crl_days = 30
`;
      await writeFile(opensslCnfPath, opensslCnf);

      await execFileAsync('openssl', [
        'ca',
        '-gencrl',
        '-config', opensslCnfPath,
        '-cert', caCertPath,
        '-keyfile', caKeyPath,
        '-out', crlPath,
      ]);

      return await readFile(crlPath, 'utf-8');
    } catch (err) {
      this.logger.error('CRL generation failed', (err as Error).message);
      throw new BadRequestException('Failed to generate CRL');
    } finally {
      // Cleanup temp files
      const files = [caCertPath, caKeyPath, crlPath, indexPath, serialPath, opensslCnfPath, indexPath + '.attr'];
      await Promise.allSettled(files.map((f) => unlink(f)));
      await rmdir(tmpDir).catch(() => {});
    }
  }

  private formatOpenSSLDate(date: Date): string {
    const y = date.getUTCFullYear().toString().slice(2);
    const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const d = date.getUTCDate().toString().padStart(2, '0');
    const h = date.getUTCHours().toString().padStart(2, '0');
    const min = date.getUTCMinutes().toString().padStart(2, '0');
    const s = date.getUTCSeconds().toString().padStart(2, '0');
    return `${y}${m}${d}${h}${min}${s}Z`;
  }
}
