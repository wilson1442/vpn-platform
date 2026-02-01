import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';

const SENSITIVE_FIELDS = ['password', 'refreshToken', 'accessToken', 'token', 'secret', 'caKeyEncrypted', 'keyEncrypted'];

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Only audit mutating operations
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const action = `${method} ${request.route?.path || request.url}`;
    const actorId = request.user?.sub;
    const ipAddress = request.ip || request.connection?.remoteAddress;
    const sanitizedBody = this.sanitize(request.body);

    return next.handle().pipe(
      tap((response) => {
        this.audit.log({
          actorId,
          action,
          targetType: context.getClass().name,
          targetId: response?.id,
          metadata: { body: sanitizedBody },
          ipAddress,
        }).catch(() => {}); // Fire and forget
      }),
    );
  }

  private sanitize(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (SENSITIVE_FIELDS.includes(key)) {
        cleaned[key] = '[REDACTED]';
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }
}
