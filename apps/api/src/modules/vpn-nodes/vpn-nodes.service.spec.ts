import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { VpnNodesService } from './vpn-nodes.service';
import { PrismaService } from '../../common/prisma.service';
import { StatsService } from '../stats/stats.service';

describe('VpnNodesService', () => {
  let service: VpnNodesService;
  let prisma: Record<string, any>;

  const mockNode = {
    id: 'node-1',
    name: 'US East',
    hostname: 'us-east.vpn.example.com',
    port: 1194,
    agentPort: 8080,
    mgmtPort: 7505,
    isActive: true,
    lastHeartbeatAt: new Date(),
    crlVersion: 1,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      vpnNode: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        VpnNodesService,
        { provide: PrismaService, useValue: prisma },
        { provide: StatsService, useValue: { updateNodeMetrics: jest.fn() } },
      ],
    }).compile();

    service = module.get(VpnNodesService);
  });

  describe('findAll', () => {
    it('should return all nodes ordered by createdAt desc', async () => {
      prisma.vpnNode.findMany.mockResolvedValue([mockNode]);
      const result = await service.findAll();
      expect(result).toEqual([mockNode]);
      expect(prisma.vpnNode.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' } });
    });

    it('should return empty array when no nodes exist', async () => {
      prisma.vpnNode.findMany.mockResolvedValue([]);
      const result = await service.findAll();
      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a node by id', async () => {
      prisma.vpnNode.findUnique.mockResolvedValue(mockNode);
      const result = await service.findOne('node-1');
      expect(result).toEqual(mockNode);
      expect(prisma.vpnNode.findUnique).toHaveBeenCalledWith({ where: { id: 'node-1' } });
    });

    it('should throw NotFoundException if node not found', async () => {
      prisma.vpnNode.findUnique.mockResolvedValue(null);
      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a node with provided data', async () => {
      const createData = { name: 'EU West', hostname: 'eu-west.vpn.example.com' };
      prisma.vpnNode.create.mockResolvedValue({ id: 'node-2', ...createData });
      const result = await service.create(createData);
      expect(result).toEqual({ id: 'node-2', ...createData });
      expect(prisma.vpnNode.create).toHaveBeenCalledWith({ data: createData });
    });
  });

  describe('update', () => {
    it('should update a node', async () => {
      const updateData = { name: 'US East Updated', isActive: false };
      prisma.vpnNode.update.mockResolvedValue({ ...mockNode, ...updateData });
      const result = await service.update('node-1', updateData);
      expect(result.name).toBe('US East Updated');
      expect(prisma.vpnNode.update).toHaveBeenCalledWith({ where: { id: 'node-1' }, data: updateData });
    });
  });

  describe('heartbeat', () => {
    it('should update lastHeartbeatAt and crlVersion', async () => {
      prisma.vpnNode.update.mockResolvedValue({ ...mockNode, crlVersion: 5 });
      const result = await service.heartbeat('node-1', { crlVersion: 5, activeConnections: 10 });
      expect(prisma.vpnNode.update).toHaveBeenCalledWith({
        where: { id: 'node-1' },
        data: expect.objectContaining({ crlVersion: 5, lastHeartbeatAt: expect.any(Date) }),
      });
    });
  });

  describe('getStaleNodes', () => {
    it('should return nodes with stale heartbeats', async () => {
      const staleNode = { ...mockNode, lastHeartbeatAt: new Date(Date.now() - 120_000) };
      prisma.vpnNode.findMany.mockResolvedValue([staleNode]);
      const result = await service.getStaleNodes(90_000);
      expect(result).toEqual([staleNode]);
      expect(prisma.vpnNode.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          OR: [
            { lastHeartbeatAt: null },
            { lastHeartbeatAt: { lt: expect.any(Date) } },
          ],
        },
      });
    });

    it('should return empty array when all nodes are fresh', async () => {
      prisma.vpnNode.findMany.mockResolvedValue([]);
      const result = await service.getStaleNodes();
      expect(result).toEqual([]);
    });
  });
});
