import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

import { type ApiResponseEnvelope } from '../interfaces/api-response.interface';

@Injectable()
export class ResponseEnvelopeInterceptor<T>
  implements NestInterceptor<T, ApiResponseEnvelope<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponseEnvelope<T>> {
    return next.handle().pipe(
      map((payload) => {
        const candidate = payload as ApiResponseEnvelope<T>;

        if (candidate && typeof candidate === 'object' && 'status' in candidate && 'message' in candidate && 'data' in candidate) {
          return candidate;
        }

        return {
          status: 'success',
          message: 'Request successful',
          data: payload,
        };
      }),
    );
  }
}
