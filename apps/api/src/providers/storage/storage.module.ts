import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { STORAGE_PROVIDER } from "./storage-provider.interface";
import { S3StorageProvider } from "./s3-storage.provider";

@Module({
  imports: [ConfigModule],
  providers: [
    S3StorageProvider,
    {
      provide: STORAGE_PROVIDER,
      useExisting: S3StorageProvider,
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
