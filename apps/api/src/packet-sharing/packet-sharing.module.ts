import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import {
  PacketSharingController,
  PublicPacketSharingController
} from "./packet-sharing.controller.js";
import { PacketSharingService } from "./packet-sharing.service.js";

@Module({
  imports: [AuthModule],
  controllers: [PacketSharingController, PublicPacketSharingController],
  providers: [PacketSharingService]
})
export class PacketSharingModule {}
