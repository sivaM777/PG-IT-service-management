import Imap from "imap";
import { simpleParser } from "mailparser";
import { EventEmitter } from "events";

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
}

export interface ParsedEmail {
  subject: string;
  text: string;
  html: string | null;
  from: string;
  to: string[];
  date: Date;
  messageId: string;
  attachments: Array<{
    filename: string;
    contentType: string;
    content: Buffer;
  }>;
}

export class ImapClient extends EventEmitter {
  private imap: Imap | null = null;
  private config: EmailConfig;
  private isConnected = false;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(config: EmailConfig) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.imap = new Imap({
        user: this.config.username,
        password: this.config.password,
        host: this.config.host,
        port: this.config.port,
        tls: this.config.secure,
        tlsOptions: { rejectUnauthorized: false },
      });

      this.imap.once("ready", () => {
        this.isConnected = true;
        this.emit("connected");
        resolve();
      });

      this.imap.once("error", (err: Error) => {
        this.isConnected = false;
        this.emit("error", err);
        reject(err);
      });

      this.imap.once("end", () => {
        this.isConnected = false;
        this.emit("disconnected");
      });

      this.imap.connect();
    });
  }

  async disconnect(): Promise<void> {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    return new Promise((resolve) => {
      if (!this.imap) {
        resolve();
        return;
      }

      this.imap.once("end", () => {
        this.imap = null;
        resolve();
      });

      this.imap.end();
    });
  }

  async fetchNewEmails(since?: Date): Promise<ParsedEmail[]> {
    if (!this.imap || !this.isConnected) {
      throw new Error("IMAP client not connected");
    }

    return new Promise((resolve, reject) => {
      this.imap!.openBox("INBOX", false, (err: Error | null, box: any) => {
        if (err) {
          reject(err);
          return;
        }

        const searchCriteria = since ? ["UNSEEN", ["SINCE", since]] : ["UNSEEN"];

        this.imap!.search(searchCriteria, (err: Error | null, results: number[]) => {
          if (err) {
            reject(err);
            return;
          }

          if (!results || results.length === 0) {
            resolve([]);
            return;
          }

          const fetch = this.imap!.fetch(results, {
            bodies: "",
            struct: true,
          });

          const emails: ParsedEmail[] = [];
          let processed = 0;

          fetch.on("message", (msg: any, seqno: number) => {
            let emailBuffer = Buffer.alloc(0);

            msg.on("body", (stream: NodeJS.ReadableStream) => {
              stream.on("data", (chunk: Buffer) => {
                emailBuffer = Buffer.concat([emailBuffer, chunk]);
              });
            });

            msg.once("end", async () => {
              try {
                const parsed = await simpleParser(emailBuffer);
                emails.push({
                  subject: parsed.subject || "",
                  text: parsed.text || "",
                  html: parsed.html || null,
                  from: parsed.from?.text || "",
                  to: parsed.to ? (Array.isArray(parsed.to) ? parsed.to.map((a: any) => (a as any).address || (a as any).name) : [(parsed.to as any).address || (parsed.to as any).name]).filter(Boolean) : [],
                  date: parsed.date || new Date(),
                  messageId: parsed.messageId || "",
                  attachments: parsed.attachments?.map((att: any) => ({
                    filename: att.filename || "attachment",
                    contentType: att.contentType || "application/octet-stream",
                    content: att.content as Buffer,
                  })) || [],
                });
              } catch (parseErr) {
                console.error(`Error parsing email ${seqno}:`, parseErr);
              }

              processed++;
              if (processed === results.length) {
                resolve(emails);
              }
            });
          });

          fetch.once("error", (err: Error) => {
            reject(err);
          });
        });
      });
    });
  }

  startPolling(intervalMs: number = 60000): void {
    if (this.checkInterval) {
      return;
    }

    this.checkInterval = setInterval(async () => {
      try {
        const emails = await this.fetchNewEmails();
        for (const email of emails) {
          this.emit("email", email);
        }
      } catch (err) {
        this.emit("error", err);
      }
    }, intervalMs);
  }

  stopPolling(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}
