import { pino, type LoggerOptions } from "pino";

const level = process.env.LOG_LEVEL ?? "info";

const options: LoggerOptions = {
  level,
  redact: {
    paths: ["DISCORD_TOKEN", "token", "*.token", "req.headers.authorization"],
    censor: "[redacted]",
  },
};

if (process.env.NODE_ENV !== "production") {
  options.transport = {
    target: "pino-pretty",
    options: { colorize: true, translateTime: "SYS:standard" },
  };
}

export const logger = pino(options);
