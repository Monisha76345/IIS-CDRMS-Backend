/** Append-only workflow history entry (CAS-style), stored as JSON on applications. */
export interface ApplicationHistoryItem {
  id: string
  taskName: string
  performedBy: string
  sentTo: string
  startedOn: string
  completedOn: string
  comments: string
  statusBefore?: string
  statusAfter?: string
}
