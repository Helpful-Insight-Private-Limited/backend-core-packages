import { Router } from 'express';

interface EmailTemplate {
    name: string;
    subject: string;
    html: string;
    text?: string;
    variables?: string[];
    description?: string;
    isSystem?: boolean;
    updatedAt?: Date;
}
interface RenderedEmail {
    subject: string;
    html: string;
    text: string;
}
interface ITemplateStore {
    get(name: string): Promise<EmailTemplate | null>;
    save(template: EmailTemplate): Promise<void>;
    delete(name: string): Promise<boolean>;
    list(): Promise<EmailTemplate[]>;
}

declare const BASE_STYLE = "\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;\n  line-height: 1.6;\n  color: #1a202c;\n  background-color: #f7fafc;\n  margin: 0;\n  padding: 0;\n";
declare const WRAPPER_HTML: (content: string) => string;
declare const DEFAULT_TEMPLATES: EmailTemplate[];

interface TemplateEngineOptions {
    store?: ITemplateStore;
    defaultVariables?: Record<string, any>;
}
declare class EmailTemplateEngine {
    private store;
    private defaultVariables;
    constructor(options?: TemplateEngineOptions);
    getStore(): ITemplateStore;
    render(templateName: string, variables?: Record<string, any>): Promise<RenderedEmail>;
    saveTemplate(template: EmailTemplate): Promise<void>;
    listTemplates(): Promise<EmailTemplate[]>;
}

declare class MemoryTemplateStore implements ITemplateStore {
    private templates;
    constructor(loadDefaults?: boolean);
    get(name: string): Promise<EmailTemplate | null>;
    save(template: EmailTemplate): Promise<void>;
    delete(name: string): Promise<boolean>;
    list(): Promise<EmailTemplate[]>;
}

declare class PrismaTemplateStore implements ITemplateStore {
    private prismaClient;
    constructor(prismaClient: any);
    get(name: string): Promise<EmailTemplate | null>;
    save(template: EmailTemplate): Promise<void>;
    delete(name: string): Promise<boolean>;
    list(): Promise<EmailTemplate[]>;
}

declare function createTemplateRouter(engine: EmailTemplateEngine): Router;

export { BASE_STYLE, DEFAULT_TEMPLATES, type EmailTemplate, EmailTemplateEngine, type ITemplateStore, MemoryTemplateStore, PrismaTemplateStore, type RenderedEmail, type TemplateEngineOptions, WRAPPER_HTML, createTemplateRouter };
