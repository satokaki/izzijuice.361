import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  FlaskConical,
  Factory,
  Package,
  Tag,
  Stamp,
  ShoppingCart,
  Wallet,
  ClipboardList,
  AlertTriangle,
  TrendingUp,
  Users,
  Boxes,
  Activity
} from 'lucide-react';
import {
  loadInventoryCostContext,
  resolveBalanceUnitCost
} from '@/lib/inventoryCost';
import { formatCurrency as fmtMoney } from '@/lib/format';
import { useAuth } from '@/lib/AuthContext';
import { hasPermission } from '@/lib/permissions';

function KpiCard({ icon: Icon, label, value, color, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white border border-border rounded-lg p-3.5 ${
        onClick
          ? 'cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all'
          : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            {label}
          </div>

          <div className="text-xl font-bold mt-1 tabular-nums">
            {value}
          </div>
        </div>

        <div className={`w-9 h-9 rounded-md flex items-center justify-center ${color}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
      </div>
    </div>
  );
}

function QuickAction({ icon: Icon, label, path, color }) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(path)}
      className="flex items-center gap-2.5 px-3 py-2.5 bg-white border border-border rounded-lg hover:border-primary/40 hover:shadow-sm transition-all text-left w-full"
    >
      <div className={`w-8 h-8 rounded-md flex items-center justify-center ${color}`}>
        <Icon className="w-4 h-4" />
      </div>

      <span className="text-[12.5px] font-semibold">
        {label}
      </span>
    </button>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [stats, setStats] = useState({
    activeMaterials: 0,
    lowStockMaterials: 0,
    activeProduction: 0,
    waitingMaterials: 0,
    siapBottling: 0,
    siapLabeling: 0,
    belumCukai: 0,
    siapJual: 0,
    salesToday: 0,
    salesMonth: 0,
    totalPiutang: 0,
    piutangJatuhTempo: 0,
  });

  const [recentActivity, setRecentActivity] = useState([]);
  const [inventoryValue, setInventoryValue] = useState(0);
  const [loading, setLoading] = useState(true);

  const isAdmin = currentUser?.role === 'admin';

  const can = (menu, action = 'view') => {
    if (isAdmin) return true;
    return hasPermission(currentUser, menu, action);
  };

  const access = useMemo(() => ({
    dashboard: can('dashboard'),

    dashboardOperations: can('dashboard_operations'),
    dashboardStock: can('dashboard_stock'),
    dashboardInventoryValue: can('dashboard_inventory_value'),
    dashboardSales: can('dashboard_sales'),
    dashboardReceivables: can('dashboard_receivables'),
    dashboardActivity: can('dashboard_activity'),

    materials: can('master_materials'),
    stockCard: can('stock_card'),
    production: can('production'),
    bottling: can('bottling'),
    labeling: can('labeling'),
    excise: can('excise'),
    sales: can('sales'),
    payments: can('payments'),
    recipes: can('recipes'),
    reportSales: can('report_sales'),
    reportReceivables: can('report_receivables'),
    reportInventory: can('report_inventory'),

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    currentUser?.id,
    currentUser?.role,
    currentUser?.status,
    currentUser?.permissions
  ]);

  useEffect(() => {
    loadDashboard();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentUser?.id,
    currentUser?.role,
    currentUser?.status,
    currentUser?.permissions
  ]);

  const loadDashboard = async () => {
    if (!currentUser?.id && !currentUser?.email) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const requests = {};

      if (access.dashboardActivity) {
        requests.audit = isAdmin
          ? base44.entities.AuditLog
              .list('-created_date', 10)
              .catch(() => [])
          : base44.entities.AuditLog
              .filter(
                { created_by_id: currentUser?.id },
                '-created_date',
                10
              )
              .catch(() => []);
      }

      if (
        access.dashboardOperations &&
        access.materials
      ) {
        requests.materials =
          base44.entities.Material
            .list()
            .catch(() => []);
      }

      if (
        access.dashboardOperations &&
        (access.production || access.bottling)
      ) {
        requests.productions =
          base44.entities.ProductionOrder
            .list()
            .catch(() => []);
      }

      if (
        access.dashboardOperations &&
        (access.labeling || access.excise)
      ) {
        requests.labeling =
          base44.entities.LabelingOrder
            .list()
            .catch(() => []);
      }

      if (
        access.dashboardStock &&
        access.stockCard
      ) {
        requests.products =
          base44.entities.Product
            .list()
            .catch(() => []);
      }

      /*
       * OPERATIONAL KPI SOURCE OF TRUTH
       *
       * Dashboard stage inventory harus membaca StockBalance,
       * bukan status dokumen historis ProductionOrder / LabelingOrder.
       */
      if (
        access.dashboardOperations ||
        access.dashboardStock
      ) {
        requests.operationalBalances =
          base44.entities.StockBalance
            .list('-updated_date', 2000)
            .catch(() => []);
      }

      const needSalesData =
        (
          access.dashboardSales &&
          (access.sales || access.reportSales)
        ) ||
        (
          access.dashboardReceivables &&
          access.reportReceivables
        );

      if (needSalesData) {
        requests.sales =
          base44.entities.Sale
            .list('-created_date', 200)
            .catch(() => []);
      }

      if (
        access.dashboardInventoryValue &&
        access.reportInventory
      ) {
        requests.balances =
          base44.entities.StockBalance
            .list('-updated_date', 1000)
            .catch(() => []);

        requests.costCtx =
          loadInventoryCostContext()
            .catch(() => null);
      }

      const keys = Object.keys(requests);

      const values = await Promise.all(
        Object.values(requests)
      );

      const result = Object.fromEntries(
        keys.map((key, index) => [
          key,
          values[index]
        ])
      );

      const materials = result.materials || [];
      const productions = result.productions || [];
      const labeling = result.labeling || [];
      const products = result.products || [];
      const sales = result.sales || [];
      const balances = result.balances || [];
      const operationalBalances =
        result.operationalBalances || [];
      const costCtx = result.costCtx || null;
      const audit = result.audit || [];

      const today =
        new Date()
          .toISOString()
          .slice(0, 10);

      const monthPrefix =
        today.slice(0, 7);

      const salesToday =
        access.dashboardSales &&
        (access.sales || access.reportSales)
          ? sales
              .filter(
                s =>
                  s.transaction_date?.startsWith(today) &&
                  s.transaction_status === 'posted'
              )
              .reduce(
                (sum, s) =>
                  sum +
                  (Number(s.total) || 0),
                0
              )
          : 0;

      const salesMonth =
        access.dashboardSales &&
        (access.sales || access.reportSales)
          ? sales
              .filter(
                s =>
                  s.transaction_date?.startsWith(monthPrefix) &&
                  s.transaction_status === 'posted'
              )
              .reduce(
                (sum, s) =>
                  sum +
                  (Number(s.total) || 0),
                0
              )
          : 0;

      const totalPiutang =
        access.dashboardReceivables &&
        access.reportReceivables
          ? sales
              .filter(
                s =>
                  s.transaction_status === 'posted'
              )
              .reduce(
                (sum, s) =>
                  sum +
                  (Number(s.remaining_receivable) || 0),
                0
              )
          : 0;

      setStats({
        activeMaterials:
          access.dashboardOperations &&
          access.materials
            ? materials.filter(
                m => m.is_active
              ).length
            : 0,

        lowStockMaterials: 0,

        activeProduction:
          access.dashboardOperations &&
          access.production
            ? productions.filter(
                p =>
                  [
                    'sedang_diproses',
                    'siap_produksi'
                  ].includes(p.status)
              ).length
            : 0,

        waitingMaterials:
          access.dashboardOperations &&
          access.production
            ? productions.filter(
                p =>
                  p.status ===
                  'menunggu_bahan'
              ).length
            : 0,

        /*
         * Stage KPI = jumlah balance/lot aktif pada stage tersebut.
         *
         * IMPORTANT:
         * Ini BUKAN total unit/ml. Satu StockBalance positif dihitung
         * sebagai satu posisi stok aktif pada stage.
         */
        siapBottling:
          access.dashboardOperations &&
          access.bottling
            ? operationalBalances.filter(
                b =>
                  b.item_type === 'product' &&
                  b.inventory_status === 'BULK' &&
                  Number(
                    b.available_quantity ??
                    b.quantity ??
                    0
                  ) > 0
              ).length
            : 0,

        siapLabeling:
          access.dashboardOperations &&
          access.labeling
            ? operationalBalances.filter(
                b =>
                  b.item_type === 'product' &&
                  b.inventory_status ===
                    'READY_FOR_LABELING' &&
                  Number(
                    b.available_quantity ??
                    b.quantity ??
                    0
                  ) > 0
              ).length
            : 0,

        belumCukai:
          access.dashboardOperations &&
          access.excise
            ? operationalBalances.filter(
                b =>
                  b.item_type === 'product' &&
                  b.inventory_status ===
                    'UNEXCISED' &&
                  Number(
                    b.available_quantity ??
                    b.quantity ??
                    0
                  ) > 0
              ).length
            : 0,

        siapJual:
          access.dashboardStock &&
          access.stockCard
            ? operationalBalances.filter(
                b =>
                  b.item_type === 'product' &&
                  b.inventory_status ===
                    'READY_FOR_SALE' &&
                  Number(
                    b.available_quantity ??
                    b.quantity ??
                    0
                  ) > 0
              ).length
            : 0,

        salesToday,
        salesMonth,
        totalPiutang,
        piutangJatuhTempo: 0,
      });

      if (
        access.dashboardInventoryValue &&
        access.reportInventory &&
        costCtx
      ) {
        const invVal =
          balances.reduce(
            (sum, balance) =>
              sum +
              (
                Number(
                  balance.quantity
                ) || 0
              ) *
              resolveBalanceUnitCost(
                balance,
                {
                  materialById:
                    costCtx.materialById,
                  stageCostIndex:
                    costCtx.stageCostIndex
                }
              ),
            0
          );

        setInventoryValue(invVal);
      } else {
        setInventoryValue(0);
      }

      setRecentActivity(
        access.dashboardActivity
          ? audit
          : []
      );

    } catch (e) {
      console.error(
        'Dashboard load error',
        e
      );
    } finally {
      setLoading(false);
    }
  };

  const operationalStatus = [
    (
      access.dashboardOperations &&
      access.bottling
    )
      ? {
          label: 'Siap Bottling',
          value: stats.siapBottling,
          color: 'bg-violet-500'
        }
      : null,

    (
      access.dashboardOperations &&
      access.labeling
    )
      ? {
          label: 'Siap Labeling',
          value: stats.siapLabeling,
          color: 'bg-purple-500'
        }
      : null,

    (
      access.dashboardOperations &&
      access.excise
    )
      ? {
          label: 'Belum Cukai',
          value: stats.belumCukai,
          color: 'bg-orange-500'
        }
      : null,

    (
      access.dashboardStock &&
      access.stockCard
    )
      ? {
          label: 'Siap Jual',
          value: stats.siapJual,
          color: 'bg-emerald-500'
        }
      : null,
  ].filter(Boolean);

  const quickActions = [
    can('production', 'create')
      ? {
          icon: Factory,
          label: 'Produksi Baru',
          path: '/production',
          color: 'bg-indigo-50 text-indigo-600'
        }
      : null,

    can('bottling', 'view')
      ? {
          icon: Package,
          label: 'Bottling',
          path: '/bottling',
          color: 'bg-violet-50 text-violet-600'
        }
      : null,

    can('labeling', 'view')
      ? {
          icon: Tag,
          label: 'Labeling',
          path: '/labeling',
          color: 'bg-purple-50 text-purple-600'
        }
      : null,

    can('excise', 'view')
      ? {
          icon: Stamp,
          label: 'Proses Cukai',
          path: '/excise',
          color: 'bg-orange-50 text-orange-600'
        }
      : null,

    can('sales', 'create')
      ? {
          icon: ShoppingCart,
          label: 'Penjualan Baru',
          path: '/sales',
          color: 'bg-emerald-50 text-emerald-600'
        }
      : null,

    can('payments', 'view')
      ? {
          icon: Wallet,
          label: 'Pembayaran Piutang',
          path: '/payments',
          color: 'bg-cyan-50 text-cyan-600'
        }
      : null,

    can('stock_card', 'view')
      ? {
          icon: ClipboardList,
          label: 'Kartu Stok',
          path: '/stock-card',
          color: 'bg-slate-100 text-slate-600'
        }
      : null,

    can('recipes', 'view')
      ? {
          icon: FlaskConical,
          label: 'Resep',
          path: '/recipes',
          color: 'bg-blue-50 text-blue-600'
        }
      : null,
  ].filter(Boolean);

  return (
    <div className="p-5 max-w-[1400px] mx-auto">

      <div className="mb-5">
        <h1 className="font-heading text-xl font-bold tracking-tight">
          Dashboard — LAB PRO v3.6.1 DEV
        </h1>

        <p className="text-[13px] text-muted-foreground mt-0.5">
          LAB PRO · DEV / BETA TEST · OPERATIONAL COST TEST
        </p>
      </div>

      {(
        access.dashboardOperations ||
        access.dashboardStock ||
        access.dashboardInventoryValue
      ) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">

          {(
            access.dashboardOperations &&
            access.materials
          ) && (
            <KpiCard
              icon={Boxes}
              label="Bahan Aktif"
              value={stats.activeMaterials}
              color="bg-blue-50 text-blue-600"
              onClick={() =>
                navigate('/master/materials')
              }
            />
          )}

          {(
            access.dashboardStock &&
            access.stockCard
          ) && (
            <KpiCard
              icon={AlertTriangle}
              label="Stok Minimum"
              value={stats.lowStockMaterials}
              color="bg-red-50 text-red-600"
            />
          )}

          {(
            access.dashboardOperations &&
            access.production
          ) && (
            <>
              <KpiCard
                icon={Factory}
                label="Produksi Aktif"
                value={stats.activeProduction}
                color="bg-indigo-50 text-indigo-600"
                onClick={() =>
                  navigate('/production')
                }
              />

              <KpiCard
                icon={AlertTriangle}
                label="Menunggu Bahan"
                value={stats.waitingMaterials}
                color="bg-amber-50 text-amber-600"
              />
            </>
          )}

          {(
            access.dashboardOperations &&
            access.bottling
          ) && (
            <KpiCard
              icon={Package}
              label="Siap Bottling"
              value={stats.siapBottling}
              color="bg-violet-50 text-violet-600"
              onClick={() =>
                navigate('/bottling')
              }
            />
          )}

          {(
            access.dashboardOperations &&
            access.labeling
          ) && (
            <KpiCard
              icon={Tag}
              label="Siap Labeling"
              value={stats.siapLabeling}
              color="bg-purple-50 text-purple-600"
              onClick={() =>
                navigate('/labeling')
              }
            />
          )}

          {(
            access.dashboardOperations &&
            access.excise
          ) && (
            <KpiCard
              icon={Stamp}
              label="Belum Cukai"
              value={stats.belumCukai}
              color="bg-orange-50 text-orange-600"
              onClick={() =>
                navigate('/excise')
              }
            />
          )}

          {(
            access.dashboardStock &&
            access.stockCard
          ) && (
            <KpiCard
              icon={TrendingUp}
              label="Siap Jual"
              value={stats.siapJual}
              color="bg-emerald-50 text-emerald-600"
            />
          )}

          {(
            access.dashboardInventoryValue &&
            access.reportInventory
          ) && (
            <KpiCard
              icon={Wallet}
              label="Nilai Persediaan"
              value={fmtMoney(inventoryValue)}
              color="bg-emerald-50 text-emerald-600"
              onClick={() =>
                navigate('/reports/inventory')
              }
            />
          )}

        </div>
      )}

      {(
        (
          access.dashboardSales &&
          (access.sales || access.reportSales)
        ) ||
        (
          access.dashboardReceivables &&
          access.reportReceivables
        )
      ) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">

          {(
            access.dashboardSales &&
            (access.sales || access.reportSales)
          ) && (
            <>
              <KpiCard
                icon={ShoppingCart}
                label="Penjualan Hari Ini"
                value={fmtMoney(stats.salesToday)}
                color="bg-emerald-50 text-emerald-600"
                onClick={
                  access.sales
                    ? () =>
                        navigate('/sales')
                    : undefined
                }
              />

              <KpiCard
                icon={TrendingUp}
                label="Penjualan Bulan Ini"
                value={fmtMoney(stats.salesMonth)}
                color="bg-teal-50 text-teal-600"
              />
            </>
          )}

          {(
            access.dashboardReceivables &&
            access.reportReceivables
          ) && (
            <>
              <KpiCard
                icon={Wallet}
                label="Total Piutang"
                value={fmtMoney(stats.totalPiutang)}
                color="bg-cyan-50 text-cyan-600"
                onClick={() =>
                  navigate('/reports/receivables')
                }
              />

              <KpiCard
                icon={AlertTriangle}
                label="Piutang Jatuh Tempo"
                value={fmtMoney(stats.piutangJatuhTempo)}
                color="bg-red-50 text-red-600"
              />
            </>
          )}

        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        <div className={isAdmin ? 'lg:col-span-2' : 'lg:col-span-3'}>

          {quickActions.length > 0 && (
            <div className="bg-white border border-border rounded-lg p-4">

              <h2 className="text-[13px] font-bold mb-3 flex items-center gap-1.5">
                <Activity className="w-4 h-4" />
                Shortcut Operasional
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {quickActions.map(action => (
                  <QuickAction
                    key={action.path}
                    {...action}
                  />
                ))}
              </div>

            </div>
          )}

          {access.dashboardActivity && (
            <div
              className={`bg-white border border-border rounded-lg p-4 ${
                quickActions.length > 0
                  ? 'mt-4'
                  : ''
              }`}
            >

              <h2 className="text-[13px] font-bold mb-3 flex items-center gap-1.5">
                <Activity className="w-4 h-4" />
                Aktivitas Terbaru
              </h2>

              {loading ? (
                <div className="space-y-2">

                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-8 bg-muted/50 rounded animate-pulse"
                    />
                  ))}

                </div>
              ) : recentActivity.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-[13px]">
                  Belum ada aktivitas terbaru
                </div>
              ) : (
                <div className="space-y-1.5">

                  {recentActivity.map(log => (
                    <div
                      key={log.id}
                      className="flex items-center gap-2.5 px-2 py-2 hover:bg-muted/30 rounded text-[12px]"
                    >

                      <div className="w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />

                      <div className="flex-1 min-w-0">
                        <span className="font-medium">
                          {log.action}
                        </span>

                        <span className="text-muted-foreground">
                          {' '}· {log.module}
                        </span>

                        {log.reference_number && (
                          <span className="text-muted-foreground">
                            {' '}· {log.reference_number}
                          </span>
                        )}
                      </div>

                      <span className="text-muted-foreground text-[11px] whitespace-nowrap">
                        {log.user_name || '—'}
                      </span>

                    </div>
                  ))}

                </div>
              )}

            </div>
          )}

          {!isAdmin &&
            operationalStatus.length > 0 && (
              <div className="bg-white border border-border rounded-lg p-4 mt-4">

                <h2 className="text-[13px] font-bold mb-3">
                  Status Operasional
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">

                  {operationalStatus.map(item => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between text-[12.5px] border border-border rounded-md px-3 py-2"
                    >

                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${item.color}`} />
                        {item.label}
                      </span>

                      <span className="font-bold tabular-nums">
                        {item.value}
                      </span>

                    </div>
                  ))}

                </div>
              </div>
            )}

        </div>

        {isAdmin && (
          <div className="space-y-4">

            {operationalStatus.length > 0 && (
              <div className="bg-white border border-border rounded-lg p-4">

                <h2 className="text-[13px] font-bold mb-3">
                  Status Operasional
                </h2>

                <div className="space-y-2.5">

                  {operationalStatus.map(item => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between text-[12.5px]"
                    >

                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${item.color}`} />
                        {item.label}
                      </span>

                      <span className="font-bold tabular-nums">
                        {item.value}
                      </span>

                    </div>
                  ))}

                </div>
              </div>
            )}

            {/* DEV 3.6.1 INFO */}
            <div className="bg-white border border-border rounded-lg p-4">

              <h2 className="text-[13px] font-bold mb-3 flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                DEV 3.6.1 Info
              </h2>

              <div className="space-y-3 text-[12px] text-muted-foreground">

                <div>
                  <p>
                    <span className="font-medium text-foreground">
                      Sistem:
                    </span>
                    {' '}LAB PRO v3.6.1 DEV
                  </p>

                  <p className="mt-1">
                    <span className="font-medium text-foreground">
                      Status:
                    </span>
                    {' '}Development / Beta Test
                  </p>
                </div>

                {/* OPERATIONAL COST */}
                <div className="pt-3 border-t border-border">

                  <p className="font-semibold text-foreground mb-2">
                    Update DEV 3.6.1
                  </p>

                  <ul className="space-y-2">

                    <li className="flex gap-2">
                      <span className="text-emerald-600 font-bold">
                        ✓
                      </span>

                      <div>
                        <span className="font-medium text-foreground">
                          Menu Operational Cost
                        </span>

                        <p className="mt-0.5">
                          Menu baru untuk pencatatan biaya operasional
                          dan loss / kerugian perusahaan.
                        </p>
                      </div>
                    </li>

                    <li className="flex gap-2">
                      <span className="text-emerald-600 font-bold">
                        ✓
                      </span>

                      <div>
                        <span className="font-medium text-foreground">
                          Operational Cost UI
                        </span>

                        <p className="mt-0.5">
                          Route dan halaman Operational Cost telah
                          ditambahkan untuk pengujian DEV.
                        </p>
                      </div>
                    </li>

                    <li className="flex gap-2">
                      <span className="text-amber-600 font-bold">
                        !
                      </span>

                      <div>
                        <span className="font-medium text-foreground">
                          Phase 1 — UI Only
                        </span>

                        <p className="mt-0.5">
                          Operational Cost belum terhubung ke entity
                          Base44, Stock Adjustment, HPP, maupun
                          Laporan Laba Rugi.
                        </p>
                      </div>
                    </li>

                  </ul>
                </div>

                {/* FULL RESTORE STATUS */}
                <div className="pt-3 border-t border-border">

                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">

                    <div className="flex items-start gap-2">

                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />

                      <div>
                        <p className="font-semibold text-amber-900">
                          Full Restore Test — Perlu Verifikasi
                        </p>

                        <p className="mt-1 text-amber-800">
                          Pengujian restore Full Backup DEV 3.6 ke
                          DEV 3.6.1 mengalami HTTP 504 sebelum proses
                          memberikan hasil akhir.
                        </p>
                      </div>

                    </div>

                    <div className="mt-3 pt-3 border-t border-amber-200 space-y-1.5 text-amber-800">

                      <p>
                        • Sebagian data terindikasi berhasil masuk.
                      </p>

                      <p>
                        • Kelengkapan seluruh record belum terverifikasi.
                      </p>

                      <p>
                        • Belum dapat dipastikan entity atau record
                        mana yang tertinggal.
                      </p>

                      <p className="font-medium text-amber-900">
                        • Hindari Full Restore ulang sebelum data
                        hasil restore diverifikasi untuk mencegah
                        potensi duplikasi.
                      </p>

                    </div>

                  </div>
                </div>

                {/* VERIFICATION */}
                <div className="pt-3 border-t border-border">

                  <p className="font-medium text-foreground mb-1">
                    Fokus Verifikasi Restore
                  </p>

                  <ul className="space-y-1 list-disc pl-4">
                    <li>Jumlah record backup vs DEV 3.6.1</li>
                    <li>Master data</li>
                    <li>Resep</li>
                    <li>Transaksi pembelian & penjualan</li>
                    <li>Production / Bottling / Labeling / Cukai</li>
                    <li>StockLedger & StockBalance</li>
                    <li>Piutang dan pembayaran</li>
                  </ul>

                </div>

                {/* SAFETY STATUS */}
                <div className="pt-3 border-t border-border">

                  <p className="text-emerald-700 font-medium">
                    ✓ Operational Cost Phase 1 tidak mengubah data existing.
                  </p>

                  <p className="mt-1 text-[11px] text-muted-foreground">
                    DEV 3.6.1 digunakan untuk pengujian fitur baru
                    dan validasi migrasi sebelum perubahan data
                    diaktifkan.
                  </p>

                </div>

                <p className="pt-3 border-t border-border">
                  Tanggal:{' '}
                  {new Date().toLocaleDateString(
                    'id-ID',
                    {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    }
                  )}
                </p>

              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
