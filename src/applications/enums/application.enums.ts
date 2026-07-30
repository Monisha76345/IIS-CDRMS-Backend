export enum ApplicationStatus {
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  /** Engineer submitted — waiting for zone CAO */
  SUBMITTED = 'submitted',
  VERIFIED = 'verified',
  RETURNED = 'returned',
  REJECTED = 'rejected',
}

/** Site type (ZC create form): Even vs Odd shaped plots. */
export enum SiteDimensionType {
  EVEN = 'Even',
  ODD = 'Odd',
}

export enum OccupancyStatus {
  EMPTY = 'Empty',
  OCCUPIED = 'Occupied',
}
