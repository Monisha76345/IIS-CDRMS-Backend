import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CaoReviewApplicationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  remarks: string;
}

export class CaoReturnApplicationDto {
  @IsString()
  @MaxLength(2000)
  remarks: string;
}

export class CaoRejectApplicationDto {
  @IsString()
  @MaxLength(2000)
  remarks: string;
}

export const CAO_LIST_FILTERS = [
  'pending',
  'verified',
  'returned',
  'rejected',
  'all',
] as const;

export type CaoListFilter = (typeof CAO_LIST_FILTERS)[number];

export class CaoListQueryDto {
  @IsOptional()
  @IsIn(CAO_LIST_FILTERS)
  status?: CaoListFilter;
}
