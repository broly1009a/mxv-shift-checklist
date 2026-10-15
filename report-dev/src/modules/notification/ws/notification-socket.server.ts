import { WebSocket, WebSocketServer } from "ws";
import http from "http";
import jwt from "jsonwebtoken";
import { redisConnector, SocketMethods, SocketCode } from "@mss/common";
import { logger } from "@/loggers/winstonLogger";

class ClientConnection {
  constructor(
    public readonly ws: WebSocket,
    public readonly id: string,
    public readonly session?: string,
    public isAlive: boolean = true
  ) {
    ws.on("pong", () => {
      this.isAlive = true;
    });
  }

  isOpen(): boolean {
    return this.ws.readyState === WebSocket.OPEN;
  }

  send(data: string): void {
    if (this.isOpen()) {
      this.ws.send(data);
    }
  }
}

let wss: WebSocketServer;
export const clientManager = new Map<string, Set<ClientConnection>>();
export const connectionIndex = new Map<WebSocket, ClientConnection>();

interface SocketAuthenticationResult {
  isValid: boolean;
  id?: string;
  session?: string;
}

async function authenticate(request: http.IncomingMessage): Promise<SocketAuthenticationResult> {
  const gatewayUserId = request.headers["x-user-id"];
  if (gatewayUserId) {
    logger.info(`WebSocket authenticated via gateway: userId=${gatewayUserId}`);
    return {
      isValid: true,
      id: String(gatewayUserId),
    };
  }

  if (!request.url) return { isValid: false };
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const token = url.searchParams.get("token");

  if (!token) {
    return { isValid: false };
  }

  const jwtKey = process.env.JWT_KEY;
  if (!jwtKey) {
    logger.error("JWT_KEY is not defined");
    return { isValid: false };
  }

  const decoded = jwt.verify(token, jwtKey) as any;
  const userId = decoded.userId || decoded.id;

  if (!userId) {
    return { isValid: false };
  }

  return {
    isValid: true,
    id: String(userId),
    session: decoded.session,
  };
}

function resolveSession(cacheUser: any, authSession?: string): string | undefined {
  if (authSession !== undefined) {
    return authSession;
  }
  const session = cacheUser?.session ?? cacheUser?.sessionId;
  if (session === undefined || session === null) {
    return undefined;
  }
  if (typeof session === "string") {
    return session;
  }
  return JSON.stringify(session);
}

function removeConnection(conn: ClientConnection) {
  const conns = clientManager.get(conn.id);
  if (conns?.has(conn)) {
    conns.delete(conn);
    if (conns.size === 0) {
      clientManager.delete(conn.id);
    }
  }
  connectionIndex.delete(conn.ws);
}

function sendAuthResponse(ws: WebSocket, code: number, message: string) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        method: SocketMethods.AUTH,
        payload: {
          code,
          message,
        },
      })
    );
  }
  if (code !== 200) {
    ws.close();
  }
}

function onMessage(data: any, ws: WebSocket): void {
  if (data && data.method) {
    switch (data.method) {
      case "ping":
        ws.send(
          JSON.stringify({
            method: "pong",
            payload: {
              code: 200,
              message: "pong",
              timestamp: Date.now(),
            },
          })
        );
        return;
      case "heartbeat":
        ws.send(
          JSON.stringify({
            method: "heartbeat_ack",
            payload: {
              code: 200,
              message: "pong",
              timestamp: Date.now(),
            },
          })
        );
        return;
    }
  }
  logger.info(`Received WS message from client: ${JSON.stringify(data)}`);
}

export function attachNotificationWs(server: http.Server): void {
  wss = new WebSocketServer({ server });

  wss.on("connection", async (ws: WebSocket, request: http.IncomingMessage) => {
    try {
      const auth = await authenticate(request);
      if (!auth.isValid || !auth.id) {
        sendAuthResponse(ws, SocketCode.UNAUTHORIZED, "Unauthorized");
        return;
      }

      const id = auth.id;

      if (!clientManager.has(id)) {
        clientManager.set(id, new Set());
      }
      const connectionSet = clientManager.get(id)!;

      let newSession: string | undefined;
      try {
        const cacheUserStr = await redisConnector.getClient().get(`auth:session-${id}`);
        const cacheUser = cacheUserStr ? JSON.parse(cacheUserStr) : null;
        newSession = resolveSession(cacheUser, auth.session);
      } catch (redisErr) {
        logger.error(`Error while reading socket session cache: ${redisErr}`);
        sendAuthResponse(ws, SocketCode.UNAUTHORIZED, "Unauthorized");
        return;
      }

      const isSessionMismatch = Array.from(connectionSet).some((conn) => conn.session !== newSession);
      if (isSessionMismatch) {
        for (const oldConn of Array.from(connectionSet)) {
          if (oldConn.isOpen()) {
            oldConn.send(
              JSON.stringify({
                method: SocketMethods.AUTH,
                payload: {
                  message: "Tài khoản đang bị đăng nhập ở nơi khác",
                  code: SocketCode.UNAUTHORIZED,
                },
              })
            );
            oldConn.ws.close();
          }
        }
        connectionSet.clear();
      }

      const newClient = new ClientConnection(ws, id, newSession);
      connectionSet.add(newClient);
      connectionIndex.set(ws, newClient);

      sendAuthResponse(ws, 200, "OK");

      ws.on("close", () => {
        removeConnection(newClient);
      });

      ws.on("error", (error) => {
        logger.error(`Socket error: ${error.message}`);
      });

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          onMessage(message, ws);
        } catch (msgErr) {
          logger.error(`Error while onMessage socket: ${msgErr}`);
        }
      });
    } catch (err) {
      logger.error(`Error while authenticating socket: ${err}`);
      sendAuthResponse(ws, SocketCode.UNAUTHORIZED, "Unauthorized");
    }
  });

  const heartbeatTimer = setInterval(() => {
    wss.clients.forEach((ws) => {
      const conn = connectionIndex.get(ws);
      if (!conn) return;

      if (conn.isAlive === false) {
        logger.warn("Socket client not alive. Terminating...");
        ws.terminate();
        removeConnection(conn);
        return;
      }

      conn.isAlive = false;
      ws.ping();
    });
  }, 10000);

  server.on("close", () => {
    clearInterval(heartbeatTimer);
  });
}
