import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  StreamableFile,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiProduces, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import type { RequestUser } from "../common/types/request-user.js";
import { ResourceIdParam } from "../common/validation/resource-id.js";
import { BillingService } from "./billing.service.js";
import { CreateBillingPortalDto } from "./dto/create-billing-portal.dto.js";
import { createInvoicePdf } from "./invoice-pdf.js";

@ApiTags("billing")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("billing")
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  getOverview(@CurrentUser() user: RequestUser) {
    return this.billingService.getOverview(user.id);
  }

  @Post("portal")
  createPortal(@CurrentUser() user: RequestUser, @Body() input: CreateBillingPortalDto) {
    return this.billingService.createPortal(user.id, input.section);
  }

  @Get("invoices/:invoiceId/download")
  @ApiProduces("application/pdf")
  @Header("Cache-Control", "private, no-store")
  async downloadInvoice(
    @CurrentUser() user: RequestUser,
    @ResourceIdParam("invoiceId") invoiceId: string
  ) {
    const invoice = await this.billingService.getInvoiceDocument(user.id, invoiceId);
    const pdf = await createInvoicePdf(invoice);
    const safeInvoiceNumber = invoice.invoiceNumber.replace(/[^A-Za-z0-9-]/g, "-");

    return new StreamableFile(pdf, {
      disposition: `attachment; filename="proofpilot-invoice-${safeInvoiceNumber}.pdf"`,
      type: "application/pdf"
    });
  }
}
