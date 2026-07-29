export enum ApplicationStatus {
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  /** Engineer submitted — waiting for zone CAO */
  SUBMITTED = 'submitted',
  VERIFIED = 'verified',
  RETURNED = 'returned',
  REJECTED = 'rejected',
}

export enum SiteDimensionType {
  REGULAR = 'Regular',
  ODD = 'Odd',
}

export enum OccupancyStatus {
  EMPTY = 'Empty',
  OCCUPIED = 'Occupied',
}
