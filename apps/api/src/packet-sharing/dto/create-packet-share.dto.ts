import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsISO8601,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  packetSharePermissions,
  type PacketSharePermission
} from "@proofpilot/types";

export class CreatePacketShareRecipientDto {
  @ApiProperty({ example: "advisor@example.com" })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ enum: packetSharePermissions, example: "VIEW" })
  @IsIn(packetSharePermissions)
  permission!: PacketSharePermission;
}

export class CreatePacketShareDto {
  @ApiProperty({ example: "packet-export-id" })
  @IsString()
  @MaxLength(128)
  packetExportId!: string;

  @ApiProperty({ type: [CreatePacketShareRecipientDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => CreatePacketShareRecipientDto)
  recipients!: CreatePacketShareRecipientDto[];

  @ApiPropertyOptional({ example: "2026-08-01T12:00:00.000Z", nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsISO8601({ strict: true })
  expiresAt?: string | null;

  @ApiProperty({ example: false })
  @IsBoolean()
  requireEmailVerification!: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  watermarkDocuments!: boolean;
}
