import { Router, Request, Response } from 'express';
import { auditRepository, authenticateJwt, rbacGuard } from '../services.js';

export const auditRouter = Router();

auditRouter.use(authenticateJwt(), rbacGuard.requireRole('admin'));

auditRouter.get('/', async (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const logs = await auditRepository.findRecent(limit);
  res.ok(logs, { count: logs.length });
});

auditRouter.get('/target/:resource/:targetId', async (req: Request, res: Response) => {
  const { resource, targetId } = req.params;
  const logs = await auditRepository.findByTarget(resource, targetId);
  res.ok(logs, { count: logs.length });
});
