import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateTimelineEventDto {
  @ApiProperty({ example: "2026-07-02T12:00:00.000Z" })
  @IsDateString()
  occurredAt!: string;

  @ApiProperty({ example: "Account closure notice received" })
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title!: string;

  @ApiPropertyOptional({
    example: "The platform sent a closure notice after an account review."
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
