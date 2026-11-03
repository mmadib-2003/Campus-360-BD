// packages/shared/src/types.ts
export type TrustLevel = 'UNVERIFIED' | 'EMAIL_VERIFIED' | 'ID_VERIFIED' | 'TRUSTED';

export type AppRole =
  | 'STUDENT'
  | 'FACULTY'
  | 'COUNSELOR'
  | 'GOVERNING_BODY'
  | 'UNIVERSITY_ADMIN'
  | 'SUPER_ADMIN';

export type UniversityCategory =
  | 'GENERAL'
  | 'SCIENCE_AND_TECH'
  | 'ENGINEERING'
  | 'AGRICULTURAL'
  | 'SPECIALIZED'
  | 'OPEN_AND_AFFILIATING';

export type ComplaintStatus =
  | 'SUBMITTED'
  | 'ACKNOWLEDGED'
  | 'IN_REVIEW'
  | 'ACTION_TAKEN'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REOPENED'
  | 'ESCALATED'
  | 'REJECTED_WITH_REASON';
