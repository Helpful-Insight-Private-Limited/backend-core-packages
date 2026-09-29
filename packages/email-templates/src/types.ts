export interface EmailTemplate {
  name: string;
  subject: string;
  html: string;
  text?: string;
  variables?: string[];
  description?: string;
  isSystem?: boolean;
  updatedAt?: Date;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface ITemplateStore {
  get(name: string): Promise<EmailTemplate | null>;
  save(template: EmailTemplate): Promise<void>;
  delete(name: string): Promise<boolean>;
  list(): Promise<EmailTemplate[]>;
}
