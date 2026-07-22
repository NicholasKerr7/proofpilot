import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length, Matches } from "class-validator";

export class CreatePortfolioDemoDto {
  @ApiProperty({ example: "browser-scoped-random-visitor-token" })
  @IsString()
  @Length(32, 128)
  @Matches(/^[A-Za-z0-9_-]+$/)
  visitorToken!: string;
}
