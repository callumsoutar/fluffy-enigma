import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import type { InvoiceDocumentData, InvoiceDocumentItem, InvoicingSettings } from './InvoiceDocumentView';

const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 30,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  schoolName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#111827',
  },
  schoolInfo: {
    marginTop: 10,
    fontSize: 8,
    color: '#6b7280',
    lineHeight: 1.4,
  },
  billToContainer: {
    marginTop: 20,
  },
  billToLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  billToValue: {
    fontSize: 10,
    color: '#111827',
  },
  invoiceInfoBox: {
    width: 200,
    padding: 15,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  infoLabel: {
    fontSize: 8,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#111827',
  },
  table: {
    marginTop: 30,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tableHeaderText: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tableRowLast: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  cellDescription: { flex: 2 },
  cellQuantity: { flex: 0.5, textAlign: 'right' },
  cellRate: { flex: 1, textAlign: 'right' },
  cellAmount: { flex: 1, textAlign: 'right' },
  tableCellText: {
    fontSize: 9,
    color: '#374151',
  },
  tableCellTotal: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#111827',
  },
  totalsContainer: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  totalsBox: {
    width: 200,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  totalRowFinal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  totalLabel: {
    fontSize: 9,
    color: '#6b7280',
  },
  totalValue: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#111827',
  },
  grandTotalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#111827',
  },
  grandTotalValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#059669',
  },
  balanceDueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  balanceDueLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#dc2626',
  },
  balanceDueValue: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#dc2626',
  },
  footer: {
    marginTop: 50,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 20,
    textAlign: 'center',
  },
  footerText: {
    fontSize: 9,
    color: '#6b7280',
    marginBottom: 4,
  },
  paymentTerms: {
    fontSize: 8,
    color: '#9ca3af',
  },
});

interface InvoiceReportPDFProps {
  invoice: InvoiceDocumentData;
  items: InvoiceDocumentItem[];
  settings: InvoicingSettings;
}

const money = (n: number | null | undefined) => (typeof n === 'number' ? n : 0).toFixed(2);

const dateOnly = (v: string | null | undefined) => {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function InvoiceReportPDF({
  invoice,
  items,
  settings,
}: InvoiceReportPDFProps) {
  const taxPercent = Math.round(((invoice.taxRate ?? 0) as number) * 100);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.title}>INVOICE</Text>
              <Text style={styles.schoolName}>{settings.schoolName}</Text>
              <View style={styles.schoolInfo}>
                {settings.billingAddress ? <Text>{settings.billingAddress}</Text> : null}
                {settings.gstNumber ? <Text>GST: {settings.gstNumber}</Text> : null}
                {settings.contactPhone ? <Text>Ph: {settings.contactPhone}</Text> : null}
                {settings.contactEmail ? <Text>Email: {settings.contactEmail}</Text> : null}
              </View>

              <View style={styles.billToContainer}>
                <Text style={styles.billToLabel}>Bill To:</Text>
                <Text style={styles.billToValue}>{invoice.billToName}</Text>
              </View>
            </View>

            <View style={styles.invoiceInfoBox}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Invoice Number</Text>
                <Text style={styles.infoValue}>{invoice.invoiceNumber}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Invoice Date</Text>
                <Text style={styles.infoValue}>{dateOnly(invoice.issueDate)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Due Date</Text>
                <Text style={styles.infoValue}>{dateOnly(invoice.dueDate)}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.cellDescription}>
              <Text style={styles.tableHeaderText}>Description</Text>
            </View>
            <View style={styles.cellQuantity}>
              <Text style={styles.tableHeaderText}>Qty</Text>
            </View>
            <View style={styles.cellRate}>
              <Text style={styles.tableHeaderText}>Rate (incl. tax)</Text>
            </View>
            <View style={styles.cellAmount}>
              <Text style={styles.tableHeaderText}>Amount</Text>
            </View>
          </View>

          {items.map((item, index) => (
            <View
              key={item.id}
              style={index === items.length - 1 ? styles.tableRowLast : styles.tableRow}
            >
              <View style={styles.cellDescription}>
                <Text style={styles.tableCellText}>{item.description}</Text>
              </View>
              <View style={styles.cellQuantity}>
                <Text style={styles.tableCellText}>{item.quantity ?? 0}</Text>
              </View>
              <View style={styles.cellRate}>
                <Text style={styles.tableCellText}>${money(item.rate_inclusive ?? item.unit_price)}</Text>
              </View>
              <View style={styles.cellAmount}>
                <Text style={styles.tableCellTotal}>${money(item.line_total)}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.totalsContainer}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal (excl. Tax):</Text>
              <Text style={styles.totalValue}>${money(invoice.subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax ({taxPercent}%):</Text>
              <Text style={styles.totalValue}>${money(invoice.taxTotal)}</Text>
            </View>
            <View style={styles.totalRowFinal}>
              <Text style={styles.grandTotalLabel}>Total:</Text>
              <Text style={styles.grandTotalValue}>${money(invoice.totalAmount)}</Text>
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Paid:</Text>
              <Text style={styles.totalValue}>${money(invoice.totalPaid)}</Text>
            </View>
            <View style={styles.balanceDueRow}>
              <Text style={styles.balanceDueLabel}>Balance Due:</Text>
              <Text style={styles.balanceDueValue}>${money(invoice.balanceDue)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{settings.invoiceFooter}</Text>
          <Text style={styles.paymentTerms}>{settings.paymentTerms}</Text>
        </View>
      </Page>
    </Document>
  );
}
