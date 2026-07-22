import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import type { RequestUser } from "../common/types/request-user.js";
import { PortfolioDemoPolicyService } from "../common/services/portfolio-demo-policy.service.js";
import { ResourceIdParam } from "../common/validation/resource-id.js";
import { AccessPacketShareDto } from "./dto/access-packet-share.dto.js";
import { CreatePacketShareCommentDto } from "./dto/create-packet-share-comment.dto.js";
import { CreatePacketShareDto } from "./dto/create-packet-share.dto.js";
import { PacketShareTokenDto } from "./dto/packet-share-token.dto.js";
import { PacketSharingService } from "./packet-sharing.service.js";

@ApiTags("packet sharing")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("cases/:caseId/packet-shares")
export class PacketSharingController {
  constructor(
    private readonly packetSharingService: PacketSharingService,
    private readonly portfolioDemoPolicy: PortfolioDemoPolicyService
  ) {}

  @Get("prepare")
  prepare(@CurrentUser() user: RequestUser, @ResourceIdParam("caseId") caseId: string) {
    return this.packetSharingService.prepare(user.id, caseId);
  }

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @ResourceIdParam("caseId") caseId: string,
    @Body() input: CreatePacketShareDto
  ) {
    this.portfolioDemoPolicy.assertExternalDeliveryAllowed(user);
    return this.packetSharingService.create(user.id, caseId, input);
  }

  @Delete(":shareId")
  revoke(
    @CurrentUser() user: RequestUser,
    @ResourceIdParam("caseId") caseId: string,
    @ResourceIdParam("shareId") shareId: string
  ) {
    return this.packetSharingService.revoke(user.id, caseId, shareId);
  }
}

@ApiTags("public packet sharing")
@Controller("packet-shares")
export class PublicPacketSharingController {
  constructor(private readonly packetSharingService: PacketSharingService) {}

  @Post("metadata")
  getMetadata(@Body() input: PacketShareTokenDto) {
    return this.packetSharingService.getPublicMetadata(input.token);
  }

  @Post("access")
  access(@Body() input: AccessPacketShareDto) {
    return this.packetSharingService.createAccess(input);
  }

  @Post("content")
  getContent(
    @Headers("authorization") authorization: string | undefined,
    @Body() input: PacketShareTokenDto
  ) {
    return this.packetSharingService.getContent(
      input.token,
      readBearerToken(authorization)
    );
  }

  @Post("comments")
  addComment(
    @Headers("authorization") authorization: string | undefined,
    @Body() input: CreatePacketShareCommentDto
  ) {
    return this.packetSharingService.addComment(
      input.token,
      readBearerToken(authorization),
      input
    );
  }
}

function readBearerToken(authorization: string | undefined) {
  return authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
}
