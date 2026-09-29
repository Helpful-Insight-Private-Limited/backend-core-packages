interface MailAttachment {
    filename: string;
    content?: string | Buffer;
    path?: string;
    contentType?: string;
}
interface SendMailOptions {
    from?: string;
    to: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    subject: string;
    text?: string;
    html?: string;
    replyTo?: string;
    attachments?: MailAttachment[];
    headers?: Record<string, string>;
}
interface SendMailResult {
    success: boolean;
    messageId?: string;
    provider: string;
    error?: string;
}
interface IMailProvider {
    readonly name: string;
    sendMail(options: SendMailOptions): Promise<SendMailResult>;
}

interface SentMemoryEmail extends SendMailOptions {
    id: string;
    sentAt: Date;
}
declare class DevMemoryMailProvider implements IMailProvider {
    readonly name = "memory";
    private sentEmails;
    sendMail(options: SendMailOptions): Promise<SendMailResult>;
    getSentEmails(): SentMemoryEmail[];
    getLastEmail(): SentMemoryEmail | undefined;
    clear(): void;
}

interface MailServiceConfig {
    defaultFrom?: string;
    maxRetries?: number;
    provider: IMailProvider;
    fallbackProvider?: IMailProvider;
}
declare class MailService {
    private primaryProvider;
    private fallbackProvider?;
    private defaultFrom?;
    private maxRetries;
    constructor(config: MailServiceConfig);
    static createWithMemory(): {
        service: MailService;
        memoryProvider: DevMemoryMailProvider;
    };
    send(options: SendMailOptions): Promise<SendMailResult>;
}

interface SmtpConfig {
    host: string;
    port: number;
    secure?: boolean;
    auth?: {
        user: string;
        pass: string;
    };
    from?: string;
    tls?: Record<string, any>;
}
declare class SmtpMailProvider implements IMailProvider {
    readonly name = "smtp";
    private transporter;
    private defaultFrom?;
    constructor(config: SmtpConfig);
    sendMail(options: SendMailOptions): Promise<SendMailResult>;
    verifyConnection(): Promise<boolean>;
}

interface AwsSesConfig {
    region: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    from?: string;
    /**
     * If using standard SES SMTP credentials (recommended by AWS)
     */
    smtpHost?: string;
    smtpPort?: number;
}
declare class AwsSesMailProvider implements IMailProvider {
    readonly name = "aws-ses";
    private transporter;
    private defaultFrom?;
    constructor(config: AwsSesConfig);
    sendMail(options: SendMailOptions): Promise<SendMailResult>;
}

interface SendGridConfig {
    apiKey: string;
    from?: string;
}
declare class SendGridMailProvider implements IMailProvider {
    readonly name = "sendgrid";
    private apiKey;
    private defaultFrom?;
    constructor(config: SendGridConfig);
    sendMail(options: SendMailOptions): Promise<SendMailResult>;
}

interface MailgunConfig {
    apiKey: string;
    domain: string;
    region?: 'us' | 'eu';
    from?: string;
}
declare class MailgunMailProvider implements IMailProvider {
    readonly name = "mailgun";
    private apiKey;
    private domain;
    private baseUrl;
    private defaultFrom?;
    constructor(config: MailgunConfig);
    sendMail(options: SendMailOptions): Promise<SendMailResult>;
}

export { type AwsSesConfig, AwsSesMailProvider, DevMemoryMailProvider, type IMailProvider, type MailAttachment, MailService, type MailServiceConfig, type MailgunConfig, MailgunMailProvider, type SendGridConfig, SendGridMailProvider, type SendMailOptions, type SendMailResult, type SentMemoryEmail, type SmtpConfig, SmtpMailProvider };
