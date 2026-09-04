import type { Class, Enrollment } from "../domain.js";
import type { Collection, CursorQuery, SortDirection } from "../pagination.js";

export interface ListClassesQuery extends CursorQuery {
  isActive?: boolean;
  search?: string;
  sort?: "name" | "createdAt";
  direction?: SortDirection;
}

export type ListClassesResponse = Collection<Class>;

export interface CreateClassBody {
  name: string;
  code: string;
  professorId: string;
}

export type CreateClassResponse = Class;

export type GetClassResponse = Class;

export interface UpdateClassBody {
  name?: string;
  code?: string;
  professorId?: string;
}

export type UpdateClassResponse = Class;

export interface ListEnrollmentsQuery extends CursorQuery {
  sort?: "enrolledAt";
  direction?: SortDirection;
}

export type ListEnrollmentsResponse = Collection<Enrollment>;

export type PutEnrollmentResponse = Enrollment;
