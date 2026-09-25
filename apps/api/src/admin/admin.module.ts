import { Module } from "@nestjs/common";
import { AliasModule } from "../alias/alias.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

@Module({
  imports: [AliasModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
