import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

/**
 * Logs only method/path/status/requestId — never request bodies, query
 * params, or exception messages that might echo back user-submitted PHI
 * (e.g. a validation error quoting a submitted field value).
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("HttpException");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException ? exception.getResponse() : "Internal server error";

    this.logger.error(
      `${request.method} ${request.path} -> ${status} [reqId=${(request as any).id ?? "n/a"}]`,
    );

    response.status(status).json(
      typeof message === "string"
        ? { statusCode: status, message }
        : { statusCode: status, ...(message as object) },
    );
  }
}
