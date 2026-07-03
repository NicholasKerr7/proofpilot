export function parseRedisConnection(redisUrl: string) {
  const parsedUrl = new URL(redisUrl);
  const connection: {
    host: string;
    port: number;
    username?: string;
    password?: string;
  } = {
    host: parsedUrl.hostname,
    port: Number(parsedUrl.port || 6379)
  };

  if (parsedUrl.username) {
    connection.username = decodeURIComponent(parsedUrl.username);
  }

  if (parsedUrl.password) {
    connection.password = decodeURIComponent(parsedUrl.password);
  }

  return connection;
}
