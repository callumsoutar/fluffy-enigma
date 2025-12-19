export type AccountStatementEntryType = 'invoice' | 'payment' | 'credit_note' | 'opening_balance'

export interface AccountStatementEntry {
  date: string
  reference: string
  description: string
  /**
   * Debit/Credit sign convention:
   * - Positive = money owed by member (invoice/debit)
   * - Negative = money paid/credited by member (payment/credit)
   */
  amount: number
  /**
   * Running balance using the same sign convention as `amount`.
   */
  balance: number
  entry_type: AccountStatementEntryType
  entry_id: string
}

export interface AccountStatementResponse {
  statement: AccountStatementEntry[]
  opening_balance: number
  closing_balance: number
  /**
   * Total currently owing (typically sum of balance_due for open invoices).
   * This is computed dynamically (no stored account_balance column).
   */
  outstanding_balance: number
}


