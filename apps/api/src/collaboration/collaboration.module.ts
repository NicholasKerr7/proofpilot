import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { CollaborationController } from "./collaboration.controller.js";
import {
  CollaborationInvitationsController,
  PublicCollaborationInvitationsController
} from "./collaboration-invitations.controller.js";
import { CollaborationInvitationMailerService } from "./collaboration-invitation-mailer.service.js";
import { CollaborationService } from "./collaboration.service.js";

@Module({
  imports: [AuthModule],
  controllers: [
    CollaborationController,
    CollaborationInvitationsController,
    PublicCollaborationInvitationsController
  ],
  providers: [CollaborationInvitationMailerService, CollaborationService]
})
export class CollaborationModule {}
