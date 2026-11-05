import { Prisma } from '@prisma/client';
import type { EyeExamSortBy } from './dto/eye-exam-query.dto';

export function eyeExamOrderBy(sortBy: EyeExamSortBy = 'examDate', direction: 'asc' | 'desc' = 'desc'): Prisma.EyeExamOrderByWithRelationInput[] {
  if (sortBy === 'customerName') {
    return [{ customer: { name: direction } }, { examDate: 'desc' }, { id: 'desc' }];
  }
  if (sortBy === 'status') {
    return [{ lockedAt: { sort: direction, nulls: direction === 'asc' ? 'first' : 'last' } }, { examDate: 'desc' }, { id: 'desc' }];
  }
  return [{ examDate: direction }, { id: direction }];
}
