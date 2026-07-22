import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service.js";
import { PortfolioDemoPolicyService } from "../common/services/portfolio-demo-policy.service.js";

@Global()
@Module({
  providers: [PrismaService, PortfolioDemoPolicyService],
  exports: [PrismaService, PortfolioDemoPolicyService]
})
export class PrismaModule {}
