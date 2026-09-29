import { Router, Request, Response } from 'express';
import { EmailTemplateEngine } from './engine.js';

export function createTemplateRouter(engine: EmailTemplateEngine): Router {
  const router = Router();

  // List all templates
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const templates = await engine.listTemplates();
      res.json({ success: true, data: templates });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get single template
  router.get('/:name', async (req: Request, res: Response) => {
    try {
      const templateName = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
      const template = await engine.getStore().get(templateName);
      if (!template) {
        res.status(404).json({ success: false, error: 'Template not found' });
        return;
      }
      res.json({ success: true, data: template });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Create or Update template (Editable template requirement)
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { name, subject, html, text, variables, description } = req.body;
      if (!name || !subject || !html) {
        res.status(400).json({
          success: false,
          error: 'Fields "name", "subject", and "html" are required.'
        });
        return;
      }

      await engine.saveTemplate({
        name,
        subject,
        html,
        text,
        variables,
        description,
        isSystem: false
      });

      res.status(201).json({
        success: true,
        message: `Template '${name}' saved successfully.`
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Delete custom template
  router.delete('/:name', async (req: Request, res: Response) => {
    try {
      const templateName = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
      const template = await engine.getStore().get(templateName);
      if (template?.isSystem) {
        res.status(403).json({ success: false, error: 'Cannot delete system template' });
        return;
      }
      const deleted = await engine.getStore().delete(templateName);
      res.json({ success: true, deleted });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Live HTML browser preview
  router.get('/:name/preview', async (req: Request, res: Response) => {
    try {
      const templateName = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
      const mockVars = {
        userName: 'Alex Johnson',
        companyName: 'Acme Corp',
        actionUrl: 'https://example.com/start',
        resetUrl: 'https://example.com/reset-password?token=sample_token',
        verifyUrl: 'https://example.com/verify?token=sample_token',
        otpCode: '849201',
        expiryMinutes: 15,
        ...req.query
      };

      const rendered = await engine.render(templateName, mockVars);
      res.setHeader('Content-Type', 'text/html');
      res.send(rendered.html);
    } catch (err: any) {
      res.status(404).send(`<h3>Error previewing template:</h3><p>${err.message}</p>`);
    }
  });

  return router;
}
