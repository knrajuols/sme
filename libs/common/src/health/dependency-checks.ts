import { Socket } from 'net';

export interface DependencyCheckResult {
  ok: boolean;
  code?: string;
}

function normalizeErrorCode(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const value = (error as { code?: unknown }).code;
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return fallback;
}

export async function checkRedisPing(redisUrl: string, timeoutMs = 2000): Promise<DependencyCheckResult> {
  let url: URL;
  try {
    url = new URL(redisUrl);
  } catch {
    return { ok: false, code: 'INVALID_REDIS_URL' };
  }

  const port = url.port ? Number(url.port) : 6379;
  const host = url.hostname;

  if (!host || Number.isNaN(port)) {
    return { ok: false, code: 'INVALID_REDIS_URL' };
  }

  const username = decodeURIComponent(url.username || '');
  const password = decodeURIComponent(url.password || '');

  return new Promise((resolve) => {
    const socket = new Socket();
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ ok: false, code: 'TIMEOUT' });
    }, timeoutMs);

    let resolved = false;

    const finish = (result: DependencyCheckResult): void => {
      if (resolved) {
        return;
      }

      resolved = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(result);
    };

    socket.on('error', (error) => {
      finish({ ok: false, code: normalizeErrorCode(error, 'REDIS_CONNECT_FAILED') });
    });

    socket.on('data', (buffer) => {
      const payload = buffer.toString('utf8');

      if (payload.includes('+PONG')) {
        finish({ ok: true });
        return;
      }

      if (payload.startsWith('-')) {
        finish({ ok: false, code: 'REDIS_PING_FAILED' });
      }
    });

    socket.connect(port, host, () => {
      const commands: string[] = [];

      if (password) {
        if (username) {
          commands.push(`*3\r\n$4\r\nAUTH\r\n$${username.length}\r\n${username}\r\n$${password.length}\r\n${password}\r\n`);
        } else {
          commands.push(`*2\r\n$4\r\nAUTH\r\n$${password.length}\r\n${password}\r\n`);
        }
      }

      commands.push('*1\r\n$4\r\nPING\r\n');
      socket.write(commands.join(''));
    });
  });
}

export async function checkRabbitMqConnection(rabbitMqUrl: string, timeoutMs = 2000): Promise<DependencyCheckResult> {
  let url: URL;
  try {
    url = new URL(rabbitMqUrl);
  } catch {
    return { ok: false, code: 'INVALID_RABBITMQ_URL' };
  }

  const isTls = url.protocol === 'amqps:';
  const host = url.hostname;
  const port = url.port ? Number(url.port) : isTls ? 5671 : 5672;

  if (!host || Number.isNaN(port)) {
    return { ok: false, code: 'INVALID_RABBITMQ_URL' };
  }

  return new Promise((resolve) => {
    const socket = new Socket();
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ ok: false, code: 'TIMEOUT' });
    }, timeoutMs);

    let resolved = false;

    const finish = (result: DependencyCheckResult): void => {
      if (resolved) {
        return;
      }

      resolved = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(result);
    };

    socket.on('error', (error) => {
      finish({ ok: false, code: normalizeErrorCode(error, 'RABBITMQ_CONNECT_FAILED') });
    });

    socket.connect(port, host, () => {
      finish({ ok: true });
    });
  });
}

export async function checkHttpOk(url: string, timeoutMs = 2000): Promise<DependencyCheckResult> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false, code: `HTTP_${response.status}` };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      code: normalizeErrorCode(error, 'HTTP_CHECK_FAILED'),
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}
