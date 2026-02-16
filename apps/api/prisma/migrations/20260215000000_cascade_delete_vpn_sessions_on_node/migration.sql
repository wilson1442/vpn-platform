-- DropForeignKey
ALTER TABLE "VpnSession" DROP CONSTRAINT "VpnSession_vpnNodeId_fkey";

-- AddForeignKey
ALTER TABLE "VpnSession" ADD CONSTRAINT "VpnSession_vpnNodeId_fkey" FOREIGN KEY ("vpnNodeId") REFERENCES "VpnNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
