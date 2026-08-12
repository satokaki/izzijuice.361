import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TrendingUp, Wallet, Receipt, Percent, Download, Eye, X } from 'lucide-react';
import PdfButton from '@/components/PdfButton';
import { exportReportToPDF } from '@/lib/pdfExport';
import { formatCurrency as fmtMoney } from '@/lib/format';

const fmtPct = v => `${(Number(v) || 0).toFixed(1)}%`;

function MiniKpi({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white border border-border rounded-lg p-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground uppercase">{label}</div>
        <div className="text-base font-bold mt-1 tabular-nums truncate">{value}</div>
      </div>
      <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
    </div>
  );
}

export default function ProfitLossReport() {
  const { toast } = useToast();

  const [sales, setSales] = useState([]);
  const [saleItems, setSaleItems] = useState([]);
  const [salesLedgers, setSalesLedgers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ date_from: '', date_to: '' });
  const [detailRow, setDetailRow] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, si, sl] = await Promise.all([
        base44.entities.Sale.list('-created_date', 1000),
        base44.entities.SaleItem.list('-created_date', 3000),
        base44.entities.StockLedger.filter(
          { transaction_type: 'sales' },
          '-created_date',
          5000
        ),
      ]);

      setSales(s || []);
      setSaleItems(si || []);
      setSalesLedgers(sl || []);
    } catch {
      toast({
        variant: 'destructive',
        title: 'Gagal memuat data laporan',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * HPP v3.4:
   * gunakan frozen HPP dari StockLedger transaksi sales.
   *
   * Signed cost penting untuk edit/void:
   * quantity_out = penjualan
   * quantity_in  = reversal
   *
   * Jadi:
   * HPP invoice = Σ(out * unit_cost) - Σ(in * unit_cost)
   *
   * Ini mencegah double HPP ketika invoice diedit:
   * original OUT - reversal IN + repost OUT = HPP transaksi terbaru.
   */
  const ledgerBySale = useMemo(() => {
    const byReference = {};
    const byInvoice = {};

    salesLedgers.forEach(row => {
      const ref = row.reference_id || '';
      const trx = row.transaction_number || '';

      if (ref) {
        if (!byReference[ref]) byReference[ref] = [];
        byReference[ref].push(row);
      }

      if (trx) {
        if (!byInvoice[trx]) byInvoice[trx] = [];
        byInvoice[trx].push(row);
      }
    });

    return { byReference, byInvoice };
  }, [salesLedgers]);

  const rows = useMemo(() => {
    const itemsBySale = {};

    saleItems.forEach(item => {
      if (!itemsBySale[item.sale_id]) itemsBySale[item.sale_id] = [];
      itemsBySale[item.sale_id].push(item);
    });

    return sales
      .filter(s =>
        !['draft', 'cancelled', 'void'].includes(s.transaction_status)
      )
      .filter(s => {
        if (filters.date_from && s.transaction_date < filters.date_from) return false;
        if (filters.date_to && s.transaction_date > filters.date_to) return false;
        return true;
      })
      .map(s => {
        const items = itemsBySale[s.id] || [];
        const qty = items.reduce(
          (sum, item) => sum + (Number(item.quantity) || 0),
          0
        );

        const ledgerRows =
          ledgerBySale.byReference[s.id]?.length
            ? ledgerBySale.byReference[s.id]
            : (ledgerBySale.byInvoice[s.invoice_number] || []);

        const hpp = Math.max(
          0,
          ledgerRows.reduce((sum, row) => {
            const unitCost = Number(row.unit_cost) || 0;
            const qtyOut = Number(row.quantity_out) || 0;
            const qtyIn = Number(row.quantity_in) || 0;
            return sum + (qtyOut - qtyIn) * unitCost;
          }, 0)
        );

        const detailItems = items.map(item => {
          const itemLedgers = ledgerRows.filter(row => row.item_id === item.product_id);
          const itemHpp = Math.max(
            0,
            itemLedgers.reduce((sum, row) => {
              const unitCost = Number(row.unit_cost) || 0;
              const qtyOut = Number(row.quantity_out) || 0;
              const qtyIn = Number(row.quantity_in) || 0;
              return sum + (qtyOut - qtyIn) * unitCost;
            }, 0)
          );

          const itemQty = Number(item.quantity) || 0;
          const unitPrice = Number(item.unit_price) || 0;
          const itemRevenue = Number(item.subtotal) || (itemQty * unitPrice);
          const hppUnit = itemQty > 0 ? itemHpp / itemQty : 0;
          const itemLaba = itemRevenue - itemHpp;
          const itemMargin = itemRevenue > 0 ? (itemLaba / itemRevenue) * 100 : null;

          return {
            product_name: item.product_name || item.item_name || '-',
            qty: itemQty,
            unit_price: unitPrice,
            revenue: itemRevenue,
            hpp_unit: hppUnit,
            hpp: itemHpp,
            laba: itemLaba,
            margin: itemMargin,
          };
        });

        const revenue = Number(s.total) || 0;
        const laba = revenue - hpp;
        const margin = revenue > 0 ? (laba / revenue) * 100 : 0;

        return {
          invoice_number: s.invoice_number,
          transaction_date: s.transaction_date,
          customer_name: s.customer_name,
          qty,
          revenue,
          hpp,
          laba,
          margin,
          payment_status: s.payment_status,
          detailItems,
        };
      });
  }, [sales, saleItems, ledgerBySale, filters]);

  const summary = useMemo(() => {
    const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
    const hpp = rows.reduce((sum, row) => sum + row.hpp, 0);
    const laba = revenue - hpp;
    const margin = revenue > 0 ? (laba / revenue) * 100 : 0;

    return {
      revenue,
      hpp,
      laba,
      margin,
      count: rows.length,
    };
  }, [rows]);

  const exportCSV = () => {
    const headers = [
      'No. Invoice',
      'Tanggal',
      'Customer',
      'Qty',
      'Pendapatan',
      'HPP',
      'Laba Kotor',
      'Margin %',
      'Status',
    ];

    const csv = [
      headers,
      ...rows.map(row => [
        row.invoice_number,
        row.transaction_date,
        row.customer_name,
        row.qty,
        row.revenue,
        row.hpp,
        row.laba,
        row.margin.toFixed(1),
        row.payment_status,
      ]),
    ]
      .map(row => row.map(value => `"${value ?? ''}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = `laporan-laba-rugi-${Date.now()}.csv`;
    a.click();

    URL.revokeObjectURL(url);
    toast({ title: 'Laporan laba rugi diexport' });
  };

  const exportPDF = () =>
    exportReportToPDF({
      title: 'Laporan Laba Rugi',
      subtitle:
        `Pendapatan ${fmtMoney(summary.revenue)} · ` +
        `HPP ${fmtMoney(summary.hpp)} · ` +
        `Laba Kotor ${fmtMoney(summary.laba)} · ` +
        `Margin ${fmtPct(summary.margin)}`,
      meta: {
        period: `${filters.date_from || 'Awal'} – ${filters.date_to || 'Akhir'}`,
      },
      columns: [
        { key: 'invoice_number', header: 'No. Invoice' },
        { key: 'transaction_date', header: 'Tanggal' },
        { key: 'customer_name', header: 'Customer' },
        { key: 'qty', header: 'Qty', align: 'right' },
        { key: 'revenue', header: 'Pendapatan', align: 'right' },
        { key: 'hpp', header: 'HPP', align: 'right' },
        { key: 'laba', header: 'Laba Kotor', align: 'right' },
        { key: 'margin', header: 'Margin', align: 'right' },
        { key: 'payment_status', header: 'Status' },
      ],
      rows: rows.map(row => ({
        invoice_number: row.invoice_number || '-',
        transaction_date: row.transaction_date || '-',
        customer_name: row.customer_name || '-',
        qty: row.qty,
        revenue: fmtMoney(row.revenue),
        hpp: fmtMoney(row.hpp),
        laba: fmtMoney(row.laba),
        margin: fmtPct(row.margin),
        payment_status: row.payment_status || '-',
      })),
      fileName: `laporan-laba-rugi-${Date.now()}.pdf`,
    });

  const columns = [
    {
      key: 'invoice_number',
      header: 'No. Invoice',
      sortable: true,
      className: 'font-mono font-medium',
    },
    {
      key: 'transaction_date',
      header: 'Tanggal',
      sortable: true,
    },
    {
      key: 'customer_name',
      header: 'Customer',
      sortable: true,
      className: 'font-medium',
    },
    {
      key: 'qty',
      header: 'Qty',
      sortable: true,
      render: row => (
        <span className="tabular-nums">
          {row.qty}
        </span>
      ),
    },
    {
      key: 'revenue',
      header: 'Pendapatan',
      sortable: true,
      render: row => (
        <span className="tabular-nums">
          {fmtMoney(row.revenue)}
        </span>
      ),
    },
    {
      key: 'hpp',
      header: 'HPP',
      render: row => (
        <span className="tabular-nums">
          {fmtMoney(row.hpp)}
        </span>
      ),
    },
    {
      key: 'laba',
      header: 'Laba Kotor',
      sortable: true,
      render: row => (
        <span
          className={`tabular-nums font-medium ${
            row.laba >= 0
              ? 'text-emerald-600'
              : 'text-red-600'
          }`}
        >
          {fmtMoney(row.laba)}
        </span>
      ),
    },
    {
      key: 'margin',
      header: 'Margin',
      render: row => (
        <span className="tabular-nums">
          {fmtPct(row.margin)}
        </span>
      ),
    },
    {
      key: 'payment_status',
      header: 'Status',
      render: row => row.payment_status || '—',
    },
    {
      key: 'detail',
      header: 'Detail',
      render: row => (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 gap-1 text-[11px]"
          onClick={() => setDetailRow(row)}
        >
          <Eye className="w-3.5 h-3.5" />
          Detail
        </Button>
      ),
    },
  ];

  return (
    <div className="p-5 max-w-[1400px] mx-auto">
      <PageHeader
        title="Laporan Laba Rugi"
        description="Pendapatan vs HPP frozen transaksi penjualan per invoice (admin only)"
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={exportCSV}
              size="sm"
              variant="outline"
              className="gap-1.5"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>

            <PdfButton onExport={exportPDF} />
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <MiniKpi
          icon={Receipt}
          label="Pendapatan"
          value={fmtMoney(summary.revenue)}
          color="bg-emerald-50 text-emerald-600"
        />

        <MiniKpi
          icon={Wallet}
          label="Total HPP"
          value={fmtMoney(summary.hpp)}
          color="bg-amber-50 text-amber-600"
        />

        <MiniKpi
          icon={TrendingUp}
          label="Laba Kotor"
          value={fmtMoney(summary.laba)}
          color={
            summary.laba >= 0
              ? 'bg-teal-50 text-teal-600'
              : 'bg-red-50 text-red-600'
          }
        />

        <MiniKpi
          icon={Percent}
          label="Margin"
          value={fmtPct(summary.margin)}
          color="bg-indigo-50 text-indigo-600"
        />
      </div>

      <div className="bg-white border border-border rounded-lg p-3 mb-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div>
          <Label className="text-[11px] mb-1">
            Dari Tanggal
          </Label>

          <Input
            type="date"
            value={filters.date_from}
            onChange={event =>
              setFilters(current => ({
                ...current,
                date_from: event.target.value,
              }))
            }
            className="h-8 text-[12px]"
          />
        </div>

        <div>
          <Label className="text-[11px] mb-1">
            Sampai Tanggal
          </Label>

          <Input
            type="date"
            value={filters.date_to}
            onChange={event =>
              setFilters(current => ({
                ...current,
                date_to: event.target.value,
              }))
            }
            className="h-8 text-[12px]"
          />
        </div>

        <div className="flex items-end">
          <div className="text-[12px] text-muted-foreground">
            {summary.count} invoice
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        emptyMessage="Belum ada data penjualan"
        searchKeys={[
          'invoice_number',
          'customer_name',
        ]}
        searchPlaceholder="Cari invoice / customer..."
      />

      {detailRow && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onMouseDown={e => {
            if (e.target === e.currentTarget) setDetailRow(null);
          }}
        >
          <div className="bg-white rounded-lg shadow-xl border w-full max-w-6xl max-h-[85vh] overflow-hidden">
            <div className="px-5 py-4 border-b flex items-start justify-between gap-4">
              <div>
                <h2 className="font-bold text-base">Breakdown Laba Rugi per Item</h2>
                <div className="text-xs text-muted-foreground mt-1">
                  {detailRow.invoice_number} · {detailRow.customer_name || '-'} · {detailRow.transaction_date || '-'}
                </div>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                onClick={() => setDetailRow(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="overflow-auto max-h-[60vh]">
              <table className="w-full text-xs">
                <thead className="bg-muted/60 sticky top-0">
                  <tr className="border-b">
                    <th className="text-left px-4 py-2.5">Produk</th>
                    <th className="text-right px-3 py-2.5">Qty</th>
                    <th className="text-right px-3 py-2.5">Harga/Unit</th>
                    <th className="text-right px-3 py-2.5">Pendapatan</th>
                    <th className="text-right px-3 py-2.5">HPP/Unit</th>
                    <th className="text-right px-3 py-2.5">Total HPP</th>
                    <th className="text-right px-3 py-2.5">Laba Kotor</th>
                    <th className="text-right px-4 py-2.5">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {(detailRow.detailItems || []).map((item, index) => (
                    <tr key={`${item.product_name}-${index}`} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{item.product_name}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{item.qty}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{fmtMoney(item.unit_price)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{fmtMoney(item.revenue)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{fmtMoney(item.hpp_unit)}</td>
                      <td className="px-3 py-3 text-right tabular-nums font-medium">{fmtMoney(item.hpp)}</td>
                      <td className={`px-3 py-3 text-right tabular-nums font-medium ${item.laba >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {fmtMoney(item.laba)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {item.margin === null ? '—' : fmtPct(item.margin)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/40 font-bold border-t">
                  <tr>
                    <td className="px-4 py-3">TOTAL INVOICE</td>
                    <td className="px-3 py-3 text-right tabular-nums">{detailRow.qty}</td>
                    <td className="px-3 py-3" />
                    <td className="px-3 py-3 text-right tabular-nums">{fmtMoney(detailRow.revenue)}</td>
                    <td className="px-3 py-3" />
                    <td className="px-3 py-3 text-right tabular-nums">{fmtMoney(detailRow.hpp)}</td>
                    <td className={`px-3 py-3 text-right tabular-nums ${detailRow.laba >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {fmtMoney(detailRow.laba)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtPct(detailRow.margin)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="px-5 py-3 border-t bg-muted/20 text-[11px] text-muted-foreground">
              HPP detail menggunakan frozen unit_cost dari StockLedger transaksi sales. Produk gratis/sample tetap menampilkan biaya aktual meskipun pendapatan Rp0.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
