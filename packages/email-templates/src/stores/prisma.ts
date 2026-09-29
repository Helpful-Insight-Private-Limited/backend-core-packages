import { EmailTemplate, ITemplateStore } from '../types.js';
import { DEFAULT_TEMPLATES } from '../defaults.js';

export class PrismaTemplateStore implements ITemplateStore {
  constructor(private prismaClient: any) {}

  async get(name: string): Promise<EmailTemplate | null> {
    if (this.prismaClient?.emailTemplate) {
      const record = await this.prismaClient.emailTemplate.findUnique({
        where: { name }
      });
      if (record) {
        return {
          name: record.name,
          subject: record.subject,
          html: record.html,
          text: record.text || undefined,
          variables: record.variables ? JSON.parse(record.variables) : [],
          description: record.description || undefined,
          isSystem: record.isSystem,
          updatedAt: record.updatedAt
        };
      }
    }

    // Fallback to default system template
    const def = DEFAULT_TEMPLATES.find((t) => t.name === name);
    return def ? { ...def } : null;
  }

  async save(template: EmailTemplate): Promise<void> {
    if (!this.prismaClient?.emailTemplate) {
      throw new Error('Prisma client does not have emailTemplate model configured');
    }

    await this.prismaClient.emailTemplate.upsert({
      where: { name: template.name },
      update: {
        subject: template.subject,
        html: template.html,
        text: template.text,
        variables: template.variables ? JSON.stringify(template.variables) : null,
        description: template.description,
        isSystem: template.isSystem ?? false
      },
      create: {
        name: template.name,
        subject: template.subject,
        html: template.html,
        text: template.text,
        variables: template.variables ? JSON.stringify(template.variables) : null,
        description: template.description,
        isSystem: template.isSystem ?? false
      }
    });
  }

  async delete(name: string): Promise<boolean> {
    if (!this.prismaClient?.emailTemplate) return false;
    try {
      await this.prismaClient.emailTemplate.delete({ where: { name } });
      return true;
    } catch {
      return false;
    }
  }

  async list(): Promise<EmailTemplate[]> {
    if (!this.prismaClient?.emailTemplate) return DEFAULT_TEMPLATES;

    const dbTemplates = await this.prismaClient.emailTemplate.findMany();
    const dbMap = new Map<string, EmailTemplate>();

    for (const record of dbTemplates) {
      dbMap.set(record.name, {
        name: record.name,
        subject: record.subject,
        html: record.html,
        text: record.text || undefined,
        variables: record.variables ? JSON.parse(record.variables) : [],
        description: record.description || undefined,
        isSystem: record.isSystem,
        updatedAt: record.updatedAt
      });
    }

    // Merge with defaults so all templates exist
    for (const def of DEFAULT_TEMPLATES) {
      if (!dbMap.has(def.name)) {
        dbMap.set(def.name, def);
      }
    }

    return Array.from(dbMap.values());
  }
}
