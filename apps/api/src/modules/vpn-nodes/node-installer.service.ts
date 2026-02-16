import { Injectable, Logger } from '@nestjs/common';
import { Client, SFTPWrapper } from 'ssh2';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { PrismaService } from '../../common/prisma.service';
import { PkiService } from '../pki/pki.service';

const execFileAsync = promisify(execFile);

export interface SshConfig {
  host: string;
  port?: number;
  username?: string;
  password?: string;
  privateKey?: string;
}

interface Job {
  emitter: EventEmitter;
  status: 'running' | 'success' | 'failed';
}

@Injectable()
export class NodeInstallerService {
  private readonly logger = new Logger(NodeInstallerService.name);
  private jobs = new Map<string, Job>();

  constructor(
    private prisma: PrismaService,
    private pkiService: PkiService,
  ) {}

  install(nodeId: string, sshConfig: SshConfig): string {
    const jobId = uuidv4();
    const emitter = new EventEmitter();
    this.jobs.set(jobId, { emitter, status: 'running' });
    this.runInstall(jobId, nodeId, sshConfig);
    return jobId;
  }

  restart(nodeId: string, sshConfig: SshConfig): string {
    const jobId = uuidv4();
    const emitter = new EventEmitter();
    this.jobs.set(jobId, { emitter, status: 'running' });
    this.runRestart(jobId, nodeId, sshConfig);
    return jobId;
  }

  reinstall(nodeId: string, sshConfig: SshConfig): string {
    const jobId = uuidv4();
    const emitter = new EventEmitter();
    this.jobs.set(jobId, { emitter, status: 'running' });
    this.runReinstall(jobId, nodeId, sshConfig);
    return jobId;
  }

  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  private log(jobId: string, message: string) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.emitter.emit('log', message);
    }
    this.logger.log(`[${jobId.substring(0, 8)}] ${message}`);
  }

  private setStatus(jobId: string, status: 'success' | 'failed') {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = status;
      job.emitter.emit('status', status);
    }
  }

  private connectSsh(sshConfig: SshConfig): Promise<Client> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      conn.on('ready', () => resolve(conn));
      conn.on('error', (err) => reject(err));
      conn.connect({
        host: sshConfig.host,
        port: sshConfig.port || 22,
        username: sshConfig.username || 'root',
        password: sshConfig.password,
        privateKey: sshConfig.privateKey,
      });
    });
  }

  private execSsh(conn: Client, command: string, jobId: string): Promise<number> {
    return new Promise((resolve, reject) => {
      conn.exec(command, (err, stream) => {
        if (err) return reject(err);
        stream.on('data', (data: Buffer) => {
          const lines = data.toString().split('\n');
          for (const line of lines) {
            if (line.trim()) this.log(jobId, line);
          }
        });
        stream.stderr.on('data', (data: Buffer) => {
          const lines = data.toString().split('\n');
          for (const line of lines) {
            if (line.trim()) this.log(jobId, `[stderr] ${line}`);
          }
        });
        stream.on('close', (code: number) => {
          resolve(code);
        });
      });
    });
  }

  private getSftp(conn: Client): Promise<SFTPWrapper> {
    return new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) return reject(err);
        resolve(sftp);
      });
    });
  }

  private sftpMkdir(sftp: SFTPWrapper, path: string): Promise<void> {
    return new Promise((resolve) => {
      sftp.mkdir(path, (err) => {
        resolve();
      });
    });
  }

  /** Recursively create remote directory and all parents */
  private async sftpMkdirp(sftp: SFTPWrapper, dirPath: string): Promise<void> {
    const parts = dirPath.split('/').filter(Boolean);
    let current = '';
    for (const part of parts) {
      current += '/' + part;
      await this.sftpMkdir(sftp, current);
    }
  }

  private sftpWriteFile(sftp: SFTPWrapper, remotePath: string, content: string | Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const stream = sftp.createWriteStream(remotePath);
      stream.on('error', reject);
      stream.on('close', () => resolve());
      stream.end(content);
    });
  }

  private async sftpUploadDir(sftp: SFTPWrapper, localDir: string, remoteDir: string, jobId: string): Promise<void> {
    await this.sftpMkdirp(sftp, remoteDir);
    const entries = await readdir(localDir, { withFileTypes: true });
    for (const entry of entries) {
      const localPath = join(localDir, entry.name);
      const remotePath = `${remoteDir}/${entry.name}`;
      if (entry.isDirectory()) {
        await this.sftpUploadDir(sftp, localPath, remotePath, jobId);
      } else {
        const content = await readFile(localPath);
        await this.sftpWriteFile(sftp, remotePath, content);
        this.log(jobId, `  uploaded: ${remotePath}`);
      }
    }
  }

  private async ensureNodeAgentBuilt(): Promise<void> {
    const distPath = join(process.cwd(), '..', 'node-agent', 'dist');
    try {
      await stat(distPath);
    } catch {
      this.logger.log('Building node-agent...');
      await execFileAsync('pnpm', ['--filter', 'node-agent', 'build'], {
        cwd: join(process.cwd(), '..', '..'),
      });
    }
  }

  private async runInstall(jobId: string, nodeId: string, sshConfig: SshConfig) {
    let conn: Client | null = null;
    try {
      const node = await this.prisma.vpnNode.findUniqueOrThrow({ where: { id: nodeId } });
      await this.prisma.vpnNode.update({ where: { id: nodeId }, data: { installStatus: 'installing' } });

      this.log(jobId, `Starting installation for node "${node.name}" (${sshConfig.host})`);

      // Ensure node-agent is built
      this.log(jobId, 'Ensuring node-agent is built...');
      await this.ensureNodeAgentBuilt();
      this.log(jobId, 'Node-agent build ready.');

      // Connect SSH
      this.log(jobId, `Connecting via SSH to ${sshConfig.host}:${sshConfig.port || 22}...`);
      conn = await this.connectSsh(sshConfig);
      this.log(jobId, 'SSH connected.');

      // Step 1: Install system packages
      this.log(jobId, '--- Step 1: Installing system packages ---');
      let code = await this.execSsh(conn, 'export DEBIAN_FRONTEND=noninteractive && apt-get update && apt-get install -y openvpn curl gnupg iptables', jobId);
      if (code !== 0) throw new Error(`apt-get failed with exit code ${code}`);

      // Step 2: Install Node.js 22 via NodeSource
      this.log(jobId, '--- Step 2: Installing Node.js 22 ---');
      code = await this.execSsh(conn, 'curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs', jobId);
      if (code !== 0) throw new Error(`Node.js install failed with exit code ${code}`);

      // Step 3: Create directories on remote
      this.log(jobId, '--- Step 3: Creating directories ---');
      code = await this.execSsh(conn, 'mkdir -p /opt/vpn-node-agent /etc/openvpn/scripts /var/log/openvpn', jobId);
      if (code !== 0) throw new Error(`mkdir failed with exit code ${code}`);

      // Step 4: Upload node-agent files via SFTP
      this.log(jobId, '--- Step 4: Uploading node-agent files ---');
      const sftp = await this.getSftp(conn);
      const baseDir = join(process.cwd(), '..');

      // Upload dist/
      const agentDistDir = join(baseDir, 'node-agent', 'dist');
      await this.sftpUploadDir(sftp, agentDistDir, '/opt/vpn-node-agent/dist', jobId);

      // Upload package.json — rewrite to remove workspace: protocol refs
      const agentPkgRaw = await readFile(join(baseDir, 'node-agent', 'package.json'), 'utf-8');
      const agentPkg = JSON.parse(agentPkgRaw);
      // Remove workspace deps — we upload @vpn/shared manually
      if (agentPkg.dependencies) {
        for (const [key, val] of Object.entries(agentPkg.dependencies)) {
          if (typeof val === 'string' && (val as string).startsWith('workspace:')) {
            delete agentPkg.dependencies[key];
          }
        }
      }
      if (agentPkg.devDependencies) {
        for (const [key, val] of Object.entries(agentPkg.devDependencies)) {
          if (typeof val === 'string' && (val as string).startsWith('workspace:')) {
            delete agentPkg.devDependencies[key];
          }
        }
      }
      await this.sftpWriteFile(sftp, '/opt/vpn-node-agent/package.json', JSON.stringify(agentPkg, null, 2));
      this.log(jobId, '  uploaded: /opt/vpn-node-agent/package.json');

      // Upload scripts
      const scriptsDir = join(baseDir, 'node-agent', 'src', 'scripts');
      await this.sftpUploadDir(sftp, scriptsDir, '/opt/vpn-node-agent/scripts', jobId);

      this.log(jobId, 'File upload complete.');

      // Step 5: npm install on remote (must run BEFORE uploading @vpn/shared since npm wipes node_modules)
      this.log(jobId, '--- Step 5: Installing npm dependencies ---');
      code = await this.execSsh(conn, 'cd /opt/vpn-node-agent && npm install --omit=dev', jobId);
      if (code !== 0) throw new Error(`npm install failed with exit code ${code}`);

      // Step 5b: Upload @vpn/shared AFTER npm install (npm would delete it otherwise)
      this.log(jobId, '--- Step 5b: Uploading @vpn/shared package ---');
      const sharedDir = join(baseDir, '..', 'packages', 'shared');
      const sharedDistDir = join(sharedDir, 'dist');
      await this.sftpMkdirp(sftp, '/opt/vpn-node-agent/node_modules/@vpn/shared');
      await this.sftpUploadDir(sftp, sharedDistDir, '/opt/vpn-node-agent/node_modules/@vpn/shared/dist', jobId);
      const sharedPkgJson = await readFile(join(sharedDir, 'package.json'));
      await this.sftpWriteFile(sftp, '/opt/vpn-node-agent/node_modules/@vpn/shared/package.json', sharedPkgJson);
      this.log(jobId, '  uploaded: /opt/vpn-node-agent/node_modules/@vpn/shared/package.json');

      // Step 5c: Install @vpn/shared's own dependencies (zod etc.)
      this.log(jobId, '--- Step 5c: Installing @vpn/shared dependencies ---');
      code = await this.execSsh(conn, 'cd /opt/vpn-node-agent/node_modules/@vpn/shared && npm install --omit=dev', jobId);
      if (code !== 0) throw new Error(`@vpn/shared npm install failed with exit code ${code}`);

      // Step 6: Upload CA cert
      this.log(jobId, '--- Step 6: Uploading CA certificate ---');
      const ca = await this.pkiService.getCA();
      await this.sftpWriteFile(sftp, '/etc/openvpn/ca.crt', ca.caCertPem);
      this.log(jobId, '  uploaded: /etc/openvpn/ca.crt');

      // Step 7: Issue and upload server certificate
      this.log(jobId, '--- Step 7: Issuing server certificate ---');
      const { certPem, keyPem } = await this.pkiService.issueServerCert(node.hostname);
      await this.sftpWriteFile(sftp, '/etc/openvpn/server.crt', certPem);
      this.log(jobId, '  uploaded: /etc/openvpn/server.crt');
      await this.sftpWriteFile(sftp, '/etc/openvpn/server.key', keyPem);
      this.log(jobId, '  uploaded: /etc/openvpn/server.key');

      // Step 8: Generate DH params
      this.log(jobId, '--- Step 8: Generating DH parameters (this will take a while) ---');
      code = await this.execSsh(conn, 'openssl dhparam -out /etc/openvpn/dh.pem 2048', jobId);
      if (code !== 0) throw new Error(`dhparam generation failed with exit code ${code}`);

      // Step 9: Write server.conf
      this.log(jobId, '--- Step 9: Writing OpenVPN server configuration ---');
      const serverConf = this.buildServerConf(node.port, node.mgmtPort, node.agentToken, node.agentPort);
      await this.sftpWriteFile(sftp, '/etc/openvpn/server.conf', serverConf);
      this.log(jobId, '  written: /etc/openvpn/server.conf');

      // Step 10: Upload connect/disconnect/auth scripts to /etc/openvpn/scripts/
      this.log(jobId, '--- Step 10: Uploading OpenVPN scripts ---');
      const connectScript = await readFile(join(baseDir, 'node-agent', 'src', 'scripts', 'client-connect.sh'), 'utf-8');
      const disconnectScript = await readFile(join(baseDir, 'node-agent', 'src', 'scripts', 'client-disconnect.sh'), 'utf-8');
      const authScript = await readFile(join(baseDir, 'node-agent', 'src', 'scripts', 'auth-user-pass.sh'), 'utf-8');
      await this.sftpWriteFile(sftp, '/etc/openvpn/scripts/client-connect.sh', connectScript);
      await this.sftpWriteFile(sftp, '/etc/openvpn/scripts/client-disconnect.sh', disconnectScript);
      await this.sftpWriteFile(sftp, '/etc/openvpn/scripts/auth-user-pass.sh', authScript);

      // Step 11: chmod scripts + fix key permissions + create tmp dir for auth via-file
      code = await this.execSsh(conn, 'chmod +x /etc/openvpn/scripts/*.sh && chmod 600 /etc/openvpn/server.key && mkdir -p /etc/openvpn/tmp && chmod 1777 /etc/openvpn/tmp', jobId);

      // Step 11b: Configure AppArmor local override for OpenVPN (if AppArmor is active)
      this.log(jobId, '--- Step 11b: Configuring AppArmor for OpenVPN ---');
      const apparmorOverride = `# VPN Platform: allow temp files and script execution
file rw /etc/openvpn/tmp/**,
file rix /etc/openvpn/scripts/*.sh,
file rix /usr/bin/curl,
file rix /usr/bin/logger,
file rix /usr/bin/sed,
file rix /usr/bin/bash,
file rix /usr/bin/tail,
`;
      await this.sftpMkdirp(sftp, '/etc/apparmor.d/local');
      await this.sftpWriteFile(sftp, '/etc/apparmor.d/local/openvpn', apparmorOverride);
      await this.execSsh(conn, 'if command -v apparmor_parser >/dev/null 2>&1 && [ -f /etc/apparmor.d/openvpn ]; then apparmor_parser -r /etc/apparmor.d/openvpn && echo "AppArmor profile reloaded"; else echo "AppArmor not active or no openvpn profile, skipping"; fi', jobId);

      // Step 12: Write CRL
      this.log(jobId, '--- Step 12: Writing initial CRL ---');
      const crl = await this.pkiService.getCRL();
      await this.sftpWriteFile(sftp, '/etc/openvpn/crl.pem', crl.crlPem);
      this.log(jobId, '  written: /etc/openvpn/crl.pem');

      // Step 13: Write systemd unit for vpn-node-agent
      this.log(jobId, '--- Step 13: Writing systemd service for node-agent ---');
      const apiBaseUrl = process.env.API_PUBLIC_URL || process.env.CORS_ORIGIN || `http://${process.env.API_HOST || 'localhost'}:${process.env.PORT || '3000'}`;
      const agentUnit = this.buildAgentSystemdUnit(node.agentToken, node.agentPort, node.mgmtPort, apiBaseUrl);
      await this.sftpWriteFile(sftp, '/etc/systemd/system/vpn-node-agent.service', agentUnit);
      this.log(jobId, '  written: /etc/systemd/system/vpn-node-agent.service');

      // Step 14: Write OpenVPN systemd override
      this.log(jobId, '--- Step 14: Writing OpenVPN systemd override ---');
      await this.execSsh(conn, 'mkdir -p /etc/systemd/system/openvpn@server.service.d', jobId);
      const ovpnOverride = this.buildOpenvpnOverride(node.agentToken, node.agentPort);
      await this.sftpWriteFile(sftp, '/etc/systemd/system/openvpn@server.service.d/override.conf', ovpnOverride);
      this.log(jobId, '  written: override.conf');

      // Done with SFTP
      sftp.end();

      // Step 15: Enable IP forwarding
      this.log(jobId, '--- Step 15: Enabling IP forwarding ---');
      code = await this.execSsh(conn, 'sysctl -w net.ipv4.ip_forward=1 && echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/99-vpn.conf', jobId);
      if (code !== 0) throw new Error(`sysctl failed with exit code ${code}`);

      // Step 16: iptables MASQUERADE
      this.log(jobId, '--- Step 16: Setting up NAT (iptables) ---');
      code = await this.execSsh(conn, 'iptables -t nat -C POSTROUTING -s 10.8.0.0/24 -o $(ip route | grep default | awk \'{print $5}\' | head -1) -j MASQUERADE 2>/dev/null || iptables -t nat -A POSTROUTING -s 10.8.0.0/24 -o $(ip route | grep default | awk \'{print $5}\' | head -1) -j MASQUERADE', jobId);
      if (code !== 0) this.log(jobId, 'Warning: iptables rule may need manual setup');
      // Persist iptables
      await this.execSsh(conn, 'echo iptables-persistent iptables-persistent/autosave_v4 boolean true | debconf-set-selections && echo iptables-persistent iptables-persistent/autosave_v6 boolean true | debconf-set-selections && DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent', jobId);
      await this.execSsh(conn, 'netfilter-persistent save', jobId);

      // Step 17: Ensure TUN device exists (required for OpenVPN)
      this.log(jobId, '--- Step 17: Ensuring TUN device ---');
      // Check if TUN already exists — use test -e which returns 1 if missing
      let tunAvailable = (await this.execSsh(conn, 'test -e /dev/net/tun', jobId)) === 0;
      if (!tunAvailable) {
        // Try to create it — may fail in LXC containers without host-level permission
        await this.execSsh(conn, 'mkdir -p /dev/net && mknod /dev/net/tun c 10 200 2>/dev/null && chmod 666 /dev/net/tun', jobId);
        tunAvailable = (await this.execSsh(conn, 'test -e /dev/net/tun', jobId)) === 0;
        if (!tunAvailable) {
          // Try modprobe as fallback
          await this.execSsh(conn, 'modprobe tun 2>/dev/null || true', jobId);
          tunAvailable = (await this.execSsh(conn, 'test -e /dev/net/tun', jobId)) === 0;
        }
      }
      if (!tunAvailable) {
        this.log(jobId, 'WARNING: /dev/net/tun is not available. This server appears to be an LXC container.');
        this.log(jobId, 'WARNING: You must enable TUN on the Proxmox host:');
        this.log(jobId, 'WARNING:   Add to /etc/pve/lxc/<CTID>.conf:');
        this.log(jobId, 'WARNING:     lxc.cgroup2.devices.allow: c 10:200 rwm');
        this.log(jobId, 'WARNING:     lxc.mount.entry: /dev/net/tun dev/net/tun none bind,create=file');
        this.log(jobId, 'WARNING:   Then reboot the container.');
      }

      // Step 18: Start services
      this.log(jobId, '--- Step 18: Starting services ---');
      code = await this.execSsh(conn, 'systemctl daemon-reload && systemctl enable --now vpn-node-agent', jobId);
      if (code !== 0) throw new Error(`systemctl enable vpn-node-agent failed with exit code ${code}`);

      // Start OpenVPN separately — it may fail if TUN is not available
      await this.execSsh(conn, 'systemctl enable --now openvpn@server 2>/dev/null || true', jobId);

      // Step 19: Verify services (wait for them to start)
      this.log(jobId, '--- Step 19: Verifying services ---');
      await this.execSsh(conn, 'sleep 3', jobId);

      const agentActive = await this.execSsh(conn, 'systemctl is-active vpn-node-agent', jobId);
      if (agentActive !== 0) {
        // Show why agent failed
        await this.execSsh(conn, 'journalctl -u vpn-node-agent -n 10 --no-pager', jobId);
        throw new Error('vpn-node-agent failed to start');
      }
      this.log(jobId, 'vpn-node-agent is running.');

      const ovpnActive = await this.execSsh(conn, 'systemctl is-active openvpn@server', jobId);
      if (ovpnActive !== 0) {
        if (!tunAvailable) {
          this.log(jobId, 'WARNING: openvpn@server is not active — TUN device not available (LXC host config needed).');
          this.log(jobId, 'WARNING: OpenVPN will start automatically once TUN is enabled and the container is rebooted.');
        } else {
          await this.execSsh(conn, 'tail -10 /var/log/openvpn/openvpn.log', jobId);
          throw new Error('openvpn@server failed to start');
        }
      } else {
        this.log(jobId, 'openvpn@server is running.');
      }

      // Step 20: Update status
      await this.prisma.vpnNode.update({ where: { id: nodeId }, data: { installStatus: 'installed' } });
      this.log(jobId, '=== Installation complete! ===');
      this.setStatus(jobId, 'success');
    } catch (err: any) {
      this.log(jobId, `ERROR: ${err.message}`);
      this.setStatus(jobId, 'failed');
      await this.prisma.vpnNode.update({ where: { id: nodeId }, data: { installStatus: 'failed' } }).catch(() => {});
    } finally {
      if (conn) conn.end();
    }
  }

  private async runRestart(jobId: string, nodeId: string, sshConfig: SshConfig) {
    let conn: Client | null = null;
    try {
      const node = await this.prisma.vpnNode.findUniqueOrThrow({ where: { id: nodeId } });
      this.log(jobId, `Restarting services on node "${node.name}" (${sshConfig.host})`);

      conn = await this.connectSsh(sshConfig);
      this.log(jobId, 'SSH connected.');

      // Update the systemd unit with current API URL before restarting
      this.log(jobId, 'Updating node-agent configuration...');
      const apiBaseUrl = process.env.API_PUBLIC_URL || process.env.CORS_ORIGIN || `http://${process.env.API_HOST || 'localhost'}:${process.env.PORT || '3000'}`;
      const agentUnit = this.buildAgentSystemdUnit(node.agentToken, node.agentPort, node.mgmtPort, apiBaseUrl);
      const sftp = await this.getSftp(conn);
      await this.sftpWriteFile(sftp, '/etc/systemd/system/vpn-node-agent.service', agentUnit);
      sftp.end();
      this.log(jobId, `  AGENT_API_BASE_URL set to ${apiBaseUrl}`);

      // Also update the OpenVPN override
      const ovpnOverride = this.buildOpenvpnOverride(node.agentToken, node.agentPort);
      const sftp2 = await this.getSftp(conn);
      await this.execSsh(conn, 'mkdir -p /etc/systemd/system/openvpn@server.service.d', jobId);
      await this.sftpWriteFile(sftp2, '/etc/systemd/system/openvpn@server.service.d/override.conf', ovpnOverride);
      sftp2.end();

      this.log(jobId, 'Reloading systemd and restarting services...');
      let code = await this.execSsh(conn, 'systemctl daemon-reload && systemctl restart openvpn@server vpn-node-agent', jobId);
      if (code !== 0) throw new Error(`systemctl restart failed with exit code ${code}`);

      this.log(jobId, 'Verifying services...');
      await this.execSsh(conn, 'sleep 3', jobId);
      code = await this.execSsh(conn, 'systemctl is-active openvpn@server && systemctl is-active vpn-node-agent', jobId);
      if (code !== 0) throw new Error('Service verification failed');

      this.log(jobId, '=== Restart complete! ===');
      this.setStatus(jobId, 'success');
    } catch (err: any) {
      this.log(jobId, `ERROR: ${err.message}`);
      this.setStatus(jobId, 'failed');
    } finally {
      if (conn) conn.end();
    }
  }

  private async runReinstall(jobId: string, nodeId: string, sshConfig: SshConfig) {
    let conn: Client | null = null;
    try {
      const node = await this.prisma.vpnNode.findUniqueOrThrow({ where: { id: nodeId } });
      this.log(jobId, `Reinstalling node "${node.name}" (${sshConfig.host})`);

      conn = await this.connectSsh(sshConfig);
      this.log(jobId, 'SSH connected.');

      // Stop services
      this.log(jobId, '--- Stopping existing services ---');
      await this.execSsh(conn, 'systemctl stop openvpn@server vpn-node-agent || true', jobId);

      // Clean up
      this.log(jobId, '--- Cleaning up previous installation ---');
      await this.execSsh(conn, 'rm -rf /opt/vpn-node-agent /etc/openvpn/server.conf /etc/openvpn/ca.crt /etc/openvpn/server.crt /etc/openvpn/server.key /etc/openvpn/dh.pem /etc/openvpn/crl.pem /etc/openvpn/scripts', jobId);

      conn.end();
      conn = null;

      this.log(jobId, '--- Starting fresh installation ---');
      // Run full install
      await this.runInstall(jobId, nodeId, sshConfig);
    } catch (err: any) {
      this.log(jobId, `ERROR: ${err.message}`);
      this.setStatus(jobId, 'failed');
      await this.prisma.vpnNode.update({ where: { id: nodeId }, data: { installStatus: 'failed' } }).catch(() => {});
    } finally {
      if (conn) conn.end();
    }
  }

  private buildServerConf(port: number, mgmtPort: number, agentToken: string, agentPort: number): string {
    return `port ${port}
proto udp
dev tun

ca /etc/openvpn/ca.crt
cert /etc/openvpn/server.crt
key /etc/openvpn/server.key
dh /etc/openvpn/dh.pem

crl-verify /etc/openvpn/crl.pem

verify-client-cert none
username-as-common-name
duplicate-cn

topology subnet
server 10.8.0.0 255.255.255.0
push "redirect-gateway def1 bypass-dhcp"
push "dhcp-option DNS 1.1.1.1"
push "dhcp-option DNS 8.8.8.8"

cipher AES-256-GCM
auth SHA256
tls-version-min 1.2

keepalive 10 120
persist-key
persist-tun

verb 3
status /var/log/openvpn/status.log
log-append /var/log/openvpn/openvpn.log

tmp-dir /etc/openvpn/tmp

script-security 3
auth-user-pass-verify /etc/openvpn/scripts/auth-user-pass.sh via-file
client-connect /etc/openvpn/scripts/client-connect.sh
client-disconnect /etc/openvpn/scripts/client-disconnect.sh

setenv AGENT_URL http://127.0.0.1:${agentPort}
setenv AGENT_TOKEN ${agentToken}

management 127.0.0.1 ${mgmtPort}
`;
  }

  private buildAgentSystemdUnit(agentToken: string, agentPort: number, mgmtPort: number, apiBaseUrl: string): string {
    return `[Unit]
Description=VPN Node Agent
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/vpn-node-agent
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
Environment="AGENT_TOKEN=${agentToken}"
Environment="AGENT_PORT=${agentPort}"
Environment="AGENT_API_BASE_URL=${apiBaseUrl}"
Environment="MGMT_PORT=${mgmtPort}"

[Install]
WantedBy=multi-user.target
`;
  }

  private buildOpenvpnOverride(agentToken: string, agentPort: number): string {
    return `[Service]
PrivateTmp=false
ExecStart=
ExecStart=/usr/sbin/openvpn --daemon ovpn-%i --status /run/openvpn/%i.status 10 --cd /etc/openvpn --script-security 3 --config /etc/openvpn/%i.conf --writepid /run/openvpn/%i.pid
Environment="AGENT_URL=http://127.0.0.1:${agentPort}"
Environment="AGENT_TOKEN=${agentToken}"
`;
  }
}
