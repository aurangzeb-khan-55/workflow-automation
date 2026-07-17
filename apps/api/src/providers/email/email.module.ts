import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EMAIL_PROVIDER } from "./email-provider.interface";
import { StubEmailProvider } from "./stub-email.provider";
import { MailHippoEmailProvider } from "./mailhippo-email.provider";
import { SmtpEmailProvider } from "./smtp-email.provider";

@Module({
  imports: [ConfigModule],
  providers: [
    StubEmailProvider,
    MailHippoEmailProvider,
    SmtpEmailProvider,
    {
      provide: EMAIL_PROVIDER,
      useFactory: (
        config: ConfigService,
        stub: StubEmailProvider,
        mailhippo: MailHippoEmailProvider,
        smtp: SmtpEmailProvider,
      ) => {
        const provider = config.get<string>("email.provider");
        if (provider === "mailhippo") return mailhippo;
        if (provider === "smtp") return smtp;
        return stub;
      },
      inject: [ConfigService, StubEmailProvider, MailHippoEmailProvider, SmtpEmailProvider],
    },
  ],
  exports: [EMAIL_PROVIDER],
})
export class EmailModule {}
