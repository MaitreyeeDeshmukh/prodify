import { insforge, getUserInsforge } from './insforge';

export type ActivityType =
  | 'project_created'
  | 'analysis_started'
  | 'analysis_completed'
  | 'analysis_failed'
  | 'injection_started'
  | 'injection_completed'
  | 'injection_failed'
  | 'pr_opened';

export async function logActivity(params: {
  userId: string;
  projectId?: string;
  projectName?: string;
  type: ActivityType;
  message: string;
  metadata?: Record<string, unknown>;
  accessToken?: string;
}) {
  const userInsforge = getUserInsforge(params.accessToken);
  await userInsforge.database.from('activity_events').insert({
    userId: params.userId,
    projectId: params.projectId ?? null,
    projectName: params.projectName ?? null,
    type: params.type,
    message: params.message,
    metadata: params.metadata ?? null,
  });
}
