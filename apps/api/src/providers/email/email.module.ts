import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EMAIL_PROVIDER } from "./email-provider.interface";
import { StubEmailProvider } from "./stub-email.provider";
import { MailHippoEmailProvider } from "./mailhippo-email.provider";
// TEMPORARY: remove this import + its wiring below once MailHippo API
// access is confirmed — see gmail-smtp-email.provider.ts.
import { GmailSmtpEmailProvider } from "./gmail-smtp-email.provider";

@Module({
  imports: [ConfigModule],
  providers: [
    StubEmailProvider,
    MailHippoEmailProvider,
    GmailSmtpEmailProvider,
    {
      provide: EMAIL_PROVIDER,
      useFactory: (
        config: ConfigService,
        stub: StubEmailProvider,
        mailhippo: MailHippoEmailProvider,
        gmail: GmailSmtpEmailProvider,
      ) => {
        const provider = config.get<string>("email.provider");
        if (provider === "mailhippo") return mailhippo;
        if (provider === "gmail") return gmail; // TEMPORARY testing option
        return stub;
      },
      inject: [ConfigService, StubEmailProvider, MailHippoEmailProvider, GmailSmtpEmailProvider],
    },
  ],
  exports: [EMAIL_PROVIDER],
})
export class EmailModule {}
