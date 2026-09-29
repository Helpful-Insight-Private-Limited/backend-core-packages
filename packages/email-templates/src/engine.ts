import Handlebars from 'handlebars';
import { ITemplateStore, RenderedEmail, EmailTemplate } from './types.js';
import { MemoryTemplateStore } from './stores/memory.js';

export interface TemplateEngineOptions {
  store?: ITemplateStore;
  defaultVariables?: Record<string, any>;
}

export class EmailTemplateEngine {
  private store: ITemplateStore;
  private defaultVariables: Record<string, any>;

  constructor(options: TemplateEngineOptions = {}) {
    this.store = options.store || new MemoryTemplateStore();
    this.defaultVariables = {
      companyName: 'Our Application',
      year: new Date().getFullYear(),
      ...options.defaultVariables
    };
  }

  getStore(): ITemplateStore {
    return this.store;
  }

  async render(
    templateName: string,
    variables: Record<string, any> = {}
  ): Promise<RenderedEmail> {
    const template = await this.store.get(templateName);
    if (!template) {
      throw new Error(`Email template '${templateName}' not found`);
    }

    const mergedVars = {
      ...this.defaultVariables,
      ...variables
    };

    // Compile subject
    const subjectDelegate = Handlebars.compile(template.subject);
    const subject = subjectDelegate(mergedVars);

    // Compile HTML
    const htmlDelegate = Handlebars.compile(template.html);
    const html = htmlDelegate(mergedVars);

    // Compile text
    let text = '';
    if (template.text) {
      const textDelegate = Handlebars.compile(template.text);
      text = textDelegate(mergedVars);
    } else {
      // Basic fallback to strip HTML tags
      text = html.replace(/<[^>]*>?/gm, '').trim();
    }

    return {
      subject,
      html,
      text
    };
  }

  async saveTemplate(template: EmailTemplate): Promise<void> {
    await this.store.save(template);
  }

  async listTemplates(): Promise<EmailTemplate[]> {
    return this.store.list();
  }
}
