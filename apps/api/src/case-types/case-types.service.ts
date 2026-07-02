import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class CaseTypesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.caseType.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true
      }
    });
  }
}
