// Vercel Function: POST /api/generate
import { handleGenerate } from '../server/generate';

export function POST(request: Request): Promise<Response> {
  return handleGenerate(request);
}
