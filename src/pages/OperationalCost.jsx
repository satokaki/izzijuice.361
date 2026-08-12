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
} from "lucide-react";

const COST_TYPES = [
  {
    value: "COST",
    label: "Biaya Operasional",
  },
  {
    value: "LOSS",
    label: "Rugi / Hilang",
  },
];

const CATEGORIES = [
  {
    value: "UTILITY",
    label: "Listrik & Air",
  },
  {
    value: "MAINTENANCE",
    label: "Pemeliharaan",
  },
  {
    value: "LABOR",
    label: "Tenaga Kerja",
  },
  {
    value: "TRANSPORT",
    label: "Transportasi",
  },
  {
    value: "PRODUCTION_LOSS",
    label: "Loss Produksi",
  },
  {
    value: "INVENTORY_LOSS",
    label: "Loss Inventaris",
  },
  {
    value: "DAMAGE",
    label: "Kerusakan",
  },
  {
    value: "OTHER",
    label: "Lainnya",
  },
];

function formatCurrency(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

export default function OperationalCost() {
  const [form, setForm] = useState({
    costDate: new Date().toISOString().split("T")[0],
    costType: "COST",
    category: "UTILITY",
    description: "",
    amount: "",
    notes: "",
  });

  const [items, setItems] = useState([]);

  const totalCost = useMemo(() => {
    return items
      .filter((item) => item.costType === "COST")
      .reduce((total, item) => total + Number(item.amount || 0), 0);
  }, [items]);

  const totalLoss = useMemo(() => {
    return items
      .filter((item) => item.costType === "LOSS")
      .reduce((total, item) => total + Number(item.amount || 0), 0);
  }, [items]);

  const totalOperational = totalCost + totalLoss;

  const resetForm = () => {
    setForm({
      costDate: new Date().toISOString().split("T")[0],
      costType: "COST",
      category: "UTILITY",
      description: "",
      amount: "",
      notes: "",
    });
  };

  const handleAdd = () => {
    if (!form.description.trim()) {
      alert("Deskripsi wajib diisi.");
      return;
    }

    if (!form.amount || Number(form.amount) <= 0) {
      alert("Jumlah biaya harus lebih dari 0.");
      return;
    }

    const newItem = {
      id: Date.now(),
      ...form,
      amount: Number(form.amount),
    };

    setItems((prev) => [newItem, ...prev]);

    resetForm();
  };

  const getTypeLabel = (value) => {
    return COST_TYPES.find((item) => item.value === value)?.label || value;
  };

  const getCategoryLabel = (value) => {
    return CATEGORIES.find((item) => item.value === value)?.label || value;
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Operational Cost"
        subtitle="Kelola biaya operasional dan loss perusahaan"
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Biaya Operasional
              </p>

              <p className="text-2xl font-bold text-slate-900 mt-2 tabular-nums">
                {formatCurrency(totalCost)}
              </p>
            </div>

            <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Loss / Kerugian
              </p>

              <p className="text-2xl font-bold text-slate-900 mt-2 tabular-nums">
                {formatCurrency(totalLoss)}
              </p>
            </div>

            <div className="w-11 h-11 rounded-xl bg-rose-50 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-rose-600" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white">
          <p className="text-sm text-slate-300">
            Total Cost & Loss
          </p>

          <p className="text-2xl font-bold mt-2 tabular-nums">
            {formatCurrency(totalOperational)}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Plus className="w-5 h-5 text-indigo-600" />

            <h2 className="font-semibold text-slate-900">
              Tambah Cost / Loss
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <Label>
                Tanggal
              </Label>

              <Input
                type="date"
                value={form.costDate}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    costDate: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <Label>
                Tipe
              </Label>

              <Select
                value={form.costType}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    costType: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {COST_TYPES.map((item) => (
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
              <Label>
                Kategori
              </Label>

              <Select
                value={form.category}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    category: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {CATEGORIES.map((item) => (
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
              <Label>
                Deskripsi
              </Label>

              <Textarea
                value={form.description}
                placeholder="Contoh: biaya perbaikan mesin bottling"
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                rows={3}
              />
            </div>

            <div>
              <Label>
                Jumlah
              </Label>

              <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/10">
                <span className="px-4 text-sm text-slate-400">
                  Rp
                </span>

                <input
                  type="number"
                  min="0"
                  value={form.amount}
                  placeholder="0"
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      amount: e.target.value,
                    }))
                  }
                  className="w-full py-2.5 pr-4 outline-none text-slate-900 tabular-nums"
                />
              </div>
            </div>

            <div>
              <Label>
                Catatan
              </Label>

              <Textarea
                value={form.notes}
                placeholder="Catatan tambahan..."
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
                rows={2}
              />
            </div>

            <Button
              onClick={handleAdd}
              className="w-full gap-2"
            >
              <Plus className="w-4 h-4" />

              Tambahkan
            </Button>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-200">
            <h2 className="font-semibold text-slate-900">
              Riwayat Operational Cost
            </h2>

            <p className="text-sm text-slate-500 mt-1">
              Data pada tahap ini masih tersimpan sementara di browser.
            </p>
          </div>

          {items.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-5 h-5 text-slate-400" />
              </div>

              <p className="text-sm font-medium text-slate-700">
                Belum ada operational cost
              </p>

              <p className="text-sm text-slate-400 mt-1">
                Tambahkan data dari form di sebelah kiri.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-left text-slate-500">
                    <th className="px-5 py-3 font-medium">
                      Tanggal
                    </th>

                    <th className="px-5 py-3 font-medium">
                      Tipe
                    </th>

                    <th className="px-5 py-3 font-medium">
                      Kategori
                    </th>

                    <th className="px-5 py-3 font-medium">
                      Deskripsi
                    </th>

                    <th className="px-5 py-3 font-medium text-right">
                      Jumlah
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/50"
                    >
                      <td className="px-5 py-3 text-slate-600">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="w-4 h-4 text-slate-400" />

                          {item.costDate}
                        </div>
                      </td>

                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                            item.costType === "COST"
                              ? "bg-indigo-50 text-indigo-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {getTypeLabel(item.costType)}
                        </span>
                      </td>

                      <td className="px-5 py-3 text-slate-600">
                        {getCategoryLabel(item.category)}
                      </td>

                      <td className="px-5 py-3 text-slate-900">
                        <div>
                          <p className="font-medium">
                            {item.description}
                          </p>

                          {item.notes && (
                            <p className="text-xs text-slate-400 mt-1">
                              {item.notes}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-3 text-right font-semibold text-slate-900 tabular-nums">
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

      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-800">
          <strong>Phase 1:</strong> halaman ini belum menyimpan data ke
          Base44. Tujuannya untuk memastikan menu, route, dan UI Operational
          Cost sudah stabil sebelum entity/database diaktifkan.
        </p>
      </div>
    </div>
  );
}