import { EmailTemplate, ITemplateStore } from '../types.js';
import { DEFAULT_TEMPLATES } from '../defaults.js';

export class MemoryTemplateStore implements ITemplateStore {
  private templates: Map<string, EmailTemplate> = new Map();

  constructor(loadDefaults = true) {
    if (loadDefaults) {
      for (const t of DEFAULT_TEMPLATES) {
        this.templates.set(t.name, { ...t, updatedAt: new Date() });
      }
    }
  }

  async get(name: string): Promise<EmailTemplate | null> {
    const t = this.templates.get(name);
    return t ? { ...t } : null;
  }

  async save(template: EmailTemplate): Promise<void> {
    this.templates.set(template.name, {
      ...template,
      updatedAt: new Date()
    });
  }

  async delete(name: string): Promise<boolean> {
    return this.templates.delete(name);
  }

  async list(): Promise<EmailTemplate[]> {
    return Array.from(this.templates.values());
  }
}
