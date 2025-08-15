'use client'

import { Document, Page, Text, View, StyleSheet, PDFDownloadLink } from '@react-pdf/renderer'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

// Create styles for PDF
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 30,
  },
  logo: {
    width: 120,
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#2563eb',
  },
  invoiceNumber: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
    borderBottom: '1 solid #e5e5e5',
    paddingBottom: 5,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  label: {
    width: 120,
    fontWeight: 'bold',
    color: '#666',
  },
  value: {
    flex: 1,
    color: '#333',
  },
  table: {
    marginTop: 20,
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottom: '2 solid #2563eb',
    paddingBottom: 8,
    marginBottom: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #e5e5e5',
    paddingVertical: 8,
  },
  tableCol: {
    flex: 1,
  },
  tableColHeader: {
    flex: 1,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  tableColAmount: {
    width: 100,
    textAlign: 'right',
  },
  totalsSection: {
    marginTop: 30,
    paddingTop: 20,
    borderTop: '2 solid #e5e5e5',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  totalLabel: {
    fontWeight: 'bold',
    color: '#666',
  },
  totalValue: {
    fontWeight: 'bold',
    color: '#333',
  },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTop: '2 solid #2563eb',
  },
  grandTotalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  grandTotalValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    textAlign: 'center',
    color: '#999',
    fontSize: 9,
  },
  statusBadge: {
    padding: '4 8',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  approvedBadge: {
    backgroundColor: '#10b981',
    color: 'white',
  },
  rejectedBadge: {
    backgroundColor: '#ef4444',
    color: 'white',
  },
  submittedBadge: {
    backgroundColor: '#f59e0b',
    color: 'white',
  },
  draftBadge: {
    backgroundColor: '#6b7280',
    color: 'white',
  },
  signatureSection: {
    marginTop: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureBox: {
    width: '45%',
    borderTop: '1 solid #333',
    paddingTop: 10,
    marginTop: 50,
  },
  signatureLabel: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
  },
  signatureName: {
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 5,
  },
  signatureDate: {
    fontSize: 9,
    color: '#999',
    textAlign: 'center',
    marginTop: 3,
  },
})

interface InvoiceData {
  id: string
  invoice_number: string
  client_name: string
  client_tin?: string
  client_email?: string
  client_phone?: string
  client_address?: string
  service_description?: string
  service_date?: string
  amount: number
  tax_amount: number
  withholding_tax: number
  total_amount: number
  status: string
  notes?: string
  created_at: string
  approved_at?: string
  approved_by_name?: string
  invoice_items?: Array<{
    description: string
    quantity: number
    unit_price: number
    amount: number
  }>
  tent?: {
    name: string
    business_address?: string
    business_tin?: string
  }
}

// PDF Document Component
const InvoicePDFDocument = ({ invoice }: { invoice: InvoiceData }) => {
  const getStatusStyle = () => {
    switch (invoice.status) {
      case 'approved': return styles.approvedBadge
      case 'rejected': return styles.rejectedBadge
      case 'submitted': return styles.submittedBadge
      default: return styles.draftBadge
    }
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>INVOICE</Text>
          <View style={styles.row}>
            <Text style={styles.invoiceNumber}>Invoice No: {invoice.invoice_number}</Text>
            <View style={[styles.statusBadge, getStatusStyle()]}>
              <Text>{invoice.status.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* Business Info */}
        {invoice.tent && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>From</Text>
            <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>{invoice.tent.name}</Text>
            {invoice.tent.business_address && (
              <Text style={{ marginBottom: 3 }}>{invoice.tent.business_address}</Text>
            )}
            {invoice.tent.business_tin && (
              <Text style={{ fontSize: 10, color: '#666' }}>TIN: {invoice.tent.business_tin}</Text>
            )}
          </View>
        )}

        {/* Client Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bill To</Text>
          <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>{invoice.client_name}</Text>
          {invoice.client_address && (
            <Text style={{ marginBottom: 3 }}>{invoice.client_address}</Text>
          )}
          {invoice.client_email && (
            <Text style={{ fontSize: 10, marginBottom: 2 }}>Email: {invoice.client_email}</Text>
          )}
          {invoice.client_phone && (
            <Text style={{ fontSize: 10, marginBottom: 2 }}>Phone: {invoice.client_phone}</Text>
          )}
          {invoice.client_tin && (
            <Text style={{ fontSize: 10, color: '#666' }}>TIN: {invoice.client_tin}</Text>
          )}
        </View>

        {/* Invoice Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invoice Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Invoice Date:</Text>
            <Text style={styles.value}>
              {new Date(invoice.created_at).toLocaleDateString()}
            </Text>
          </View>
          {invoice.service_date && (
            <View style={styles.row}>
              <Text style={styles.label}>Service Date:</Text>
              <Text style={styles.value}>
                {new Date(invoice.service_date).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>

        {/* Items Table */}
        {invoice.invoice_items && invoice.invoice_items.length > 0 && (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableColHeader, { flex: 2 }]}>Description</Text>
              <Text style={[styles.tableColHeader, { width: 60, textAlign: 'center' }]}>Qty</Text>
              <Text style={[styles.tableColHeader, { width: 80, textAlign: 'right' }]}>Rate</Text>
              <Text style={[styles.tableColHeader, styles.tableColAmount]}>Amount</Text>
            </View>
            {invoice.invoice_items.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={[styles.tableCol, { flex: 2 }]}>{item.description}</Text>
                <Text style={[styles.tableCol, { width: 60, textAlign: 'center' }]}>{item.quantity}</Text>
                <Text style={[styles.tableCol, { width: 80, textAlign: 'right' }]}>
                  ${item.unit_price.toFixed(2)}
                </Text>
                <Text style={[styles.tableCol, styles.tableColAmount]}>
                  ${item.amount.toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Service Description */}
        {invoice.service_description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Service Description</Text>
            <Text>{invoice.service_description}</Text>
          </View>
        )}

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal:</Text>
            <Text style={styles.totalValue}>${invoice.amount.toFixed(2)}</Text>
          </View>
          {invoice.tax_amount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax:</Text>
              <Text style={styles.totalValue}>${invoice.tax_amount.toFixed(2)}</Text>
            </View>
          )}
          {invoice.withholding_tax > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Withholding Tax:</Text>
              <Text style={styles.totalValue}>-${invoice.withholding_tax.toFixed(2)}</Text>
            </View>
          )}
          <View style={styles.grandTotal}>
            <Text style={styles.grandTotalLabel}>Total Amount Due:</Text>
            <Text style={styles.grandTotalValue}>${invoice.total_amount.toFixed(2)}</Text>
          </View>
        </View>

        {/* Notes */}
        {invoice.notes && (
          <View style={[styles.section, { marginTop: 30 }]}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={{ fontSize: 10, color: '#666' }}>{invoice.notes}</Text>
          </View>
        )}

        {/* Signature Section */}
        {invoice.status === 'approved' && (
          <View style={styles.signatureSection}>
            <View style={styles.signatureBox}>
              <Text style={styles.signatureLabel}>Prepared By</Text>
              <Text style={styles.signatureName}>Client</Text>
              <Text style={styles.signatureDate}>
                {new Date(invoice.created_at).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.signatureBox}>
              <Text style={styles.signatureLabel}>Approved By</Text>
              <Text style={styles.signatureName}>
                {invoice.approved_by_name || 'Manager'}
              </Text>
              <Text style={styles.signatureDate}>
                {invoice.approved_at 
                  ? new Date(invoice.approved_at).toLocaleDateString()
                  : ''}
              </Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          Generated on {new Date().toLocaleString()} • CreatorTent Invoice Management
        </Text>
      </Page>
    </Document>
  )
}

// Main Component with Download Button
interface InvoicePDFProps {
  invoice: InvoiceData
}

export function InvoicePDF({ invoice }: InvoicePDFProps) {
  return (
    <PDFDownloadLink
      document={<InvoicePDFDocument invoice={invoice} />}
      fileName={`invoice-${invoice.invoice_number}.pdf`}
    >
      {({ loading }) => (
        <Button 
          disabled={loading}
          className="btn-primary"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Generating PDF...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </>
          )}
        </Button>
      )}
    </PDFDownloadLink>
  )
}