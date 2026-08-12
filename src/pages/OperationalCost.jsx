import React, { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Wallet,
  TrendingDown,
  CalendarDays,
  FileText,
  Search,
  ReceiptText,
  AlertTriangle,
  X,
} from "lucide-react";

const COST_TYPES = [
  {
    value: "COST",
    label: "Biaya",
    title: "Biaya Operasional",
    description: "Pengeluaran untuk menjalankan operasional",
  },
  {
    value: "LOSS",
    label: "Loss",
    title: "Loss / Kerugian",
    description: "Kerugian karena rusak, hilang, atau kejadian lain",
  },
];

const COST_CATEGORIES = [
  { value: "UTILITY", label: "Listrik & Air" },
  { value: "MAINTENANCE", label: "Pemeliharaan" },
  { value: "LABOR", label: "Tenaga Kerja" },
  { value: "TRANSPORT", label: "Transportasi" },
  { value: "RENT", label: "Sewa" },
  { value: "SUPPLIES", label: "Perlengkapan" },
  { value: "ADMINISTRATION", label: "Administrasi" },
  { value: "OTHER", label: "Lainnya" },
];

const LOSS_CATEGORIES = [
  { value: "PRODUCTION_LOSS", label: "Loss Produksi" },
  { value: "INVENTORY_LOSS", label: "Selisih / Loss Inventaris" },
  { value: "DAMAGE", label: "Barang Rusak" },
  { value: "EXPIRED", label: "Expired" },
  { value: "MISSING", label: "Barang Hilang" },
  { value: "OTHER", label: "Lainnya" },
];

const ALL_CATEGORIES = [...COST_CATEGORIES, ...LOSS_CATEGORIES];

function formatCurrency(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatNumber(value) {
  if (value === "" || value === null || value === undefined) {
    return "";
  }

  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatDisplayDate(value) {
  if (!value) return "-";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function OperationalCost() {
  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    costDate: today,
    costType: "COST",
    category: "UTILITY",
    description: "",
    amount: "",
    notes: "",
  });

  const [items, setItems] = useState([]);

  const [filters, setFilters] = useState({
    search: "",
    type: "ALL",
  });

  const availableCategories =
    form.costType === "LOSS"
      ? LOSS_CATEGORIES
      : COST_CATEGORIES;

  const totalCost = useMemo(() => {
    return items
      .filter((item) => item.costType === "COST")
      .reduce(
        (total, item) => total + Number(item.amount || 0),
        0
      );
  }, [items]);

  const totalLoss = useMemo(() => {
    return items
      .filter((item) => item.costType === "LOSS")
      .reduce(
        (total, item) => total + Number(item.amount || 0),
        0
      );
  }, [items]);

  const totalOperational = totalCost + totalLoss;

  const filteredItems = useMemo(() => {
    const keyword = filters.search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesType =
        filters.type === "ALL" ||
        item.costType === filters.type;

      const categoryLabel =
        ALL_CATEGORIES.find(
          (category) => category.value === item.category
        )?.label || item.category;

      const matchesSearch =
        !keyword ||
        item.description
          .toLowerCase()
          .includes(keyword) ||
        (item.notes || "")
          .toLowerCase()
          .includes(keyword) ||
        categoryLabel
          .toLowerCase()
          .includes(keyword);

      return matchesType && matchesSearch;
    });
  }, [items, filters]);

  const resetForm = () => {
    setForm({
      costDate: today,
      costType: "COST",
      category: "UTILITY",
      description: "",
      amount: "",
      notes: "",
    });
  };

  const handleTypeChange = (type) => {
    const categories =
      type === "LOSS"
        ? LOSS_CATEGORIES
        : COST_CATEGORIES;

    setForm((prev) => ({
      ...prev,
      costType: type,
      category: categories[0].value,
    }));
  };

  const handleAmountChange = (event) => {
    const rawValue = event.target.value.replace(/\D/g, "");

    setForm((prev) => ({
      ...prev,
      amount: rawValue,
    }));
  };

  const handleAdd = () => {
    if (!form.costDate) {
      alert("Tanggal wajib diisi.");
      return;
    }

    if (!form.description.trim()) {
      alert("Keterangan wajib diisi.");
      return;
    }

    if (!form.amount || Number(form.amount) <= 0) {
      alert("Jumlah harus lebih dari 0.");
      return;
    }

    const newItem = {
      id: Date.now(),
      ...form,
      description: form.description.trim(),
      notes: form.notes.trim(),
      amount: Number(form.amount),
    };

    setItems((prev) => [newItem, ...prev]);

    resetForm();
  };

  const getTypeLabel = (value) => {
    return (
      COST_TYPES.find((item) => item.value === value)
        ?.title || value
    );
  };

  const getCategoryLabel = (value) => {
    return (
      ALL_CATEGORIES.find(
        (item) => item.value === value
      )?.label || value
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Cost & Loss"
        subtitle="Catat biaya dan kerugian operasional dengan sederhana"
      />

      {/* SUMMARY */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Biaya Operasional
              </p>

              <p className="text-2xl font-bold text-slate-900 mt-2 tabular-nums">
                {formatCurrency(totalCost)}
              </p>

              <p className="text-xs text-slate-400 mt-2">
                Pengeluaran operasional
              </p>
            </div>

            <div className="w-11 h-11 shrink-0 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Loss / Kerugian
              </p>

              <p className="text-2xl font-bold text-slate-900 mt-2 tabular-nums">
                {formatCurrency(totalLoss)}
              </p>

              <p className="text-xs text-slate-400 mt-2">
                Kerugian di luar biaya normal
              </p>
            </div>

            <div className="w-11 h-11 shrink-0 rounded-xl bg-rose-50 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-rose-600" />
            </div>
          </div>
        </div>

        <div className="sm:col-span-2 lg:col-span-1 bg-slate-900 rounded-2xl p-5 text-white shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-300">
                Total Cost & Loss
              </p>

              <p className="text-2xl font-bold mt-2 tabular-nums">
                {formatCurrency(totalOperational)}
              </p>

              <p className="text-xs text-slate-400 mt-2">
                Total pengurang laba operasional
              </p>
            </div>

            <div className="w-11 h-11 shrink-0 rounded-xl bg-white/10 flex items-center justify-center">
              <ReceiptText className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[380px_minmax(0,1fr)] gap-6">
        {/* FORM */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm h-fit">
          <div className="mb-6">
            <h2 className="font-semibold text-lg text-slate-900">
              Tambah Transaksi
            </h2>

            <p className="text-sm text-slate-500 mt-1">
              Pilih apakah transaksi merupakan biaya atau kerugian.
            </p>
          </div>

          <div className="space-y-5">
            {/* TYPE BUTTONS */}
            <div>
              <Label className="mb-2 block">
                Jenis
              </Label>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    handleTypeChange("COST")
                  }
                  className={`text-left rounded-xl border p-3 transition ${
                    form.costType === "COST"
                      ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Wallet
                      className={`w-4 h-4 ${
                        form.costType === "COST"
                          ? "text-indigo-600"
                          : "text-slate-400"
                      }`}
                    />

                    <span className="font-semibold text-sm text-slate-900">
                      Biaya
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 mt-1.5">
                    Pengeluaran usaha
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleTypeChange("LOSS")
                  }
                  className={`text-left rounded-xl border p-3 transition ${
                    form.costType === "LOSS"
                      ? "border-rose-500 bg-rose-50 ring-1 ring-rose-500"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <TrendingDown
                      className={`w-4 h-4 ${
                        form.costType === "LOSS"
                          ? "text-rose-600"
                          : "text-slate-400"
                      }`}
                    />

                    <span className="font-semibold text-sm text-slate-900">
                      Loss
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 mt-1.5">
                    Rusak, hilang, expired
                  </p>
                </button>
              </div>
            </div>

            <div>
              <Label>Tanggal</Label>

              <Input
                type="date"
                value={form.costDate}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    costDate: e.target.value,
                  }))
                }
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>Kategori</Label>

              <Select
                value={form.category}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    category: value,
                  }))
                }
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {availableCategories.map((item) => (
                    <SelectItem
                      key={item.value}
                      value={item.value}
                    >
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Keterangan</Label>

              <Textarea
                value={form.description}
                placeholder={
                  form.costType === "COST"
                    ? "Contoh: service mesin bottling"
                    : "Contoh: 5 botol rusak saat handling"
                }
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                rows={3}
                className="mt-1.5 resize-none"
              />
            </div>

            <div>
              <Label>Jumlah</Label>

              <div className="mt-1.5 flex items-center border border-slate-200 rounded-lg overflow-hidden focus-within:border-slate-400 focus-within:ring-1 focus-within:ring-slate-300">
                <span className="px-3 text-sm font-medium text-slate-500 border-r border-slate-200">
                  Rp
                </span>

                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumber(form.amount)}
                  placeholder="0"
                  onChange={handleAmountChange}
                  className="w-full px-3 py-2 outline-none text-slate-900 font-semibold tabular-nums bg-transparent"
                />
              </div>
            </div>

            <div>
              <Label>
                Catatan{" "}
                <span className="font-normal text-slate-400">
                  (opsional)
                </span>
              </Label>

              <Textarea
                value={form.notes}
                placeholder="Informasi tambahan bila diperlukan"
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
                rows={2}
                className="mt-1.5 resize-none"
              />
            </div>

            <Button
              onClick={handleAdd}
              className="w-full gap-2"
            >
              <Plus className="w-4 h-4" />
              Simpan {form.costType === "COST" ? "Biaya" : "Loss"}
            </Button>
          </div>
        </div>

        {/* HISTORY */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm min-w-0">
          <div className="px-5 sm:px-6 py-5 border-b border-slate-200">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
              <div>
                <h2 className="font-semibold text-lg text-slate-900">
                  Riwayat Cost & Loss
                </h2>

                <p className="text-sm text-slate-500 mt-1">
                  {items.length} transaksi tercatat
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />

                  <Input
                    value={filters.search}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        search: e.target.value,
                      }))
                    }
                    placeholder="Cari transaksi..."
                    className="pl-9 sm:w-56"
                  />
                </div>

                <Select
                  value={filters.type}
                  onValueChange={(value) =>
                    setFilters((prev) => ({
                      ...prev,
                      type: value,
                    }))
                  }
                >
                  <SelectTrigger className="sm:w-40">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="ALL">
                      Semua
                    </SelectItem>

                    <SelectItem value="COST">
                      Biaya
                    </SelectItem>

                    <SelectItem value="LOSS">
                      Loss
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="py-20 px-6 text-center">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-5 h-5 text-slate-400" />
              </div>

              <p className="text-sm font-semibold text-slate-700">
                Belum ada Cost & Loss
              </p>

              <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
                Transaksi yang ditambahkan akan muncul di sini.
              </p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 px-6 text-center">
              <Search className="w-8 h-8 text-slate-300 mx-auto mb-3" />

              <p className="font-medium text-slate-700">
                Transaksi tidak ditemukan
              </p>

              <button
                type="button"
                onClick={() =>
                  setFilters({
                    search: "",
                    type: "ALL",
                  })
                }
                className="inline-flex items-center gap-1 text-sm text-indigo-600 mt-2 hover:underline"
              >
                <X className="w-3.5 h-3.5" />
                Hapus filter
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-left text-slate-500">
                    <th className="px-5 py-3 font-medium whitespace-nowrap">
                      Tanggal
                    </th>

                    <th className="px-5 py-3 font-medium">
                      Jenis
                    </th>

                    <th className="px-5 py-3 font-medium">
                      Kategori
                    </th>

                    <th className="px-5 py-3 font-medium min-w-[220px]">
                      Keterangan
                    </th>

                    <th className="px-5 py-3 font-medium text-right whitespace-nowrap">
                      Jumlah
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="px-5 py-4 text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="w-4 h-4 text-slate-400" />

                          {formatDisplayDate(item.costDate)}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                            item.costType === "COST"
                              ? "bg-indigo-50 text-indigo-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {item.costType === "LOSS" && (
                            <AlertTriangle className="w-3 h-3" />
                          )}

                          {getTypeLabel(item.costType)}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-slate-600 whitespace-nowrap">
                        {getCategoryLabel(item.category)}
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-900">
                          {item.description}
                        </p>

                        {item.notes && (
                          <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                            {item.notes}
                          </p>
                        )}
                      </td>

                      <td
                        className={`px-5 py-4 text-right font-bold tabular-nums whitespace-nowrap ${
                          item.costType === "LOSS"
                            ? "text-rose-600"
                            : "text-slate-900"
                        }`}
                      >
                        {formatCurrency(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* PHASE INFO */}
      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-sm text-amber-800">
          <strong>Phase 1:</strong>{" "}
          Cost & Loss masih menggunakan data sementara.
          Belum ada perubahan pada database Base44, stok,
          HPP, atau laporan laba rugi.
        </p>
      </div>
    </div>
  );
}