import React, { useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import FormModal from '@/components/FormModal';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Check, X, AlertCircle } from 'lucide-react';
import { generateOperationalCostCode } from '@/lib/sequence';
import { formatCurrency, formatDate } from '@/lib/format';
import { useAuth } from '@/lib/AuthContext';
import NumberInput from '@/components/NumberInput';

const COST_TYPES = [
  { value: 'COST', label: 'Biaya Operasional' },
  { value: 'LOSS', label: 'Rugi/Hilang' },
];

const CATEGORIES = [
  { value: 'UTILITY', label: 'Listrik & Air' },
  { value: 'MAINTENANCE', label: 'Pemeliharaan' },
  { value: 'LABOR', label: 'Tenaga Kerja' },
  { value: 'TRANSPORT', label: 'Transportasi' },
  { value: 'PRODUCTION_LOSS', label: 'Rugi Produksi' },
  { value: 'INVENTORY_LOSS', label: 'Rugi Inventaris' },
  { value: 'DAMAGE', label: 'Kerusakan' },
  { value: 'OTHER', label: 'Lainnya' },
];

export default function OperationalCost() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [form, setForm] = useState({
    code: '',
    cost_date: new Date().toISOString().split('T')[0],
    cost_type: 'COST',
    category: 'UTILITY',
    description: '',
    amount: 0,
    affected_product_id: '',
    affected_material_id: '',
    quantity_loss: 0,
    document_reference: '',
    notes: '',
    attachment_url: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const items = await base44.entities.OperationalCost.list('-cost_date', 100);
      setData(items);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Gagal memuat data', description: e.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openAdd = () => {
    setEditing(null);
    setForm({
      code: '',
      cost_date: new Date().toISOString().split('T')[0],
      cost_type: 'COST',
      category: 'UTILITY',
      description: '',
      amount: 0,
      affected_product_id: '',
      affected_material_id: '',
      quantity_loss: 0,
      document_reference: '',
      notes: '',
      attachment_url: '',
    });
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      code: item.code,
      cost_date: item.cost_date,
      cost_type: item.cost_type,
      category: item.category,
      description: item.description,
      amount: item.amount || 0,
      affected_product_id: item.affected_product_id || '',
      affected_material_id: item.affected_material_id || '',
      quantity_loss: item.quantity_loss || 0,
      document_reference: item.document_reference || '',
      notes: item.notes || '',
      attachment_url: item.attachment_url || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.description || !form.cost_date || form.amount <= 0) {
      toast({ variant: 'destructive', title: 'Deskripsi, tanggal, dan jumlah wajib diisi dengan benar' });
      return;
    }

    setSubmitting(true);
    try {
      if (editing) {
        await base44.entities.OperationalCost.update(editing.id, form);
        toast({ title: 'Biaya operasional berhasil diperbarui' });
      } else {
        const code = await generateOperationalCostCode();
        const payload = {
          ...form,
          code,
          created_by_user_id: user?.id,
        };
        await base44.entities.OperationalCost.create(payload);
        toast({ title: 'Biaya operasional berhasil ditambahkan' });
      }
      setModalOpen(false);
      loadData();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan', description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (item) => {
    if (!confirm('Setujui biaya ini?')) return;
    setActionLoading(item.id);
    try {
      await base44.entities.OperationalCost.update(item.id, {
        is_approved: true,
        approved_by: user?.id,
        approval_date: new Date().toISOString(),
      });
      toast({ title: 'Biaya berhasil disetujui' });
      loadData();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Gagal menyetujui' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (item) => {
    if (!confirm('Batalkan biaya ini?')) return;
    setActionLoading(item.id);
    try {
      await base44.entities.OperationalCost.update(item.id, { is_active: false });
      toast({ title: 'Biaya dibatalkan' });
      loadData();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Gagal membatalkan' });
    } finally {
      setActionLoading(null);
    }
  };

  const getCostTypeLabel = (type) => COST_TYPES.find(t => t.value === type)?.label || type;
  const getCategoryLabel = (cat) => CATEGORIES.find(c => c.value === cat)?.label || cat;

  const columns = [
    { key: 'code', header: 'Kode', sortable: true, className: 'font-mono font-medium w-24' },
    { key: 'cost_date', header: 'Tanggal', sortable: true, render: (row) => formatDate(row.cost_date), className: 'w-28' },
    {
      key: 'cost_type',
      header: 'Tipe',
      render: (row) => (
        <span className={`inline-block px-2 py-1 rounded text-[11px] font-medium ${
          row.cost_type === 'COST' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
        }`}>
          {getCostTypeLabel(row.cost_type)}
        </span>
      ),
      className: 'w-32'
    },
    { key: 'category', header: 'Kategori', render: (row) => getCategoryLabel(row.category), sortable: true, className: 'w-40' },
    { key: 'description', header: 'Deskripsi', sortable: true, className: 'min-w-48' },
    { key: 'amount', header: 'Jumlah', render: (row) => formatCurrency(row.amount), className: 'text-right font-medium w-32' },
    {
      key: 'is_approved',
      header: 'Status',
      render: (row) => (
        <div className="flex items-center gap-2">
          {row.is_approved ? (
            <StatusBadge status="approved" />
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
              <AlertCircle className="w-3 h-3" /> Menunggu
            </span>
          )}
          {!row.is_active && <span className="text-[11px] text-muted-foreground px-2 py-0.5 bg-slate-100 rounded">Dibatalkan</span>}
        </div>
      ),
      className: 'w-32'
    },
  ];

  const actions = [
    (row) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => openEdit(row)}
        className="w-8 h-8 p-0"
      >
        <Pencil className="w-4 h-4" />
      </Button>
    ),
    (row) =>
      !row.is_approved && row.is_active ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleApprove(row)}
          disabled={actionLoading === row.id}
          className="w-8 h-8 p-0 text-green-600 hover:text-green-700"
        >
          <Check className="w-4 h-4" />
        </Button>
      ) : null,
    (row) =>
      !row.is_approved && row.is_active ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleReject(row)}
          disabled={actionLoading === row.id}
          className="w-8 h-8 p-0 text-red-600 hover:text-red-700"
        >
          <X className="w-4 h-4" />
        </Button>
      ) : null,
  ];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Biaya Operasional" 
        subtitle="Kelola biaya dan rugi operasional"
      />

      <div>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="w-4 h-4" />
          Tambah Biaya
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        actions={actions}
        emptyMessage="Belum ada data biaya operasional"
      />

      <FormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Biaya Operasional' : 'Tambah Biaya Operasional'}
        onSubmit={handleSubmit}
        submitting={submitting}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tanggal</Label>
              <Input
                type="date"
                value={form.cost_date}
                onChange={(e) => setForm({ ...form, cost_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Tipe</Label>
              <Select value={form.cost_type} onValueChange={(value) => setForm({ ...form, cost_type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COST_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Kategori</Label>
            <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Deskripsi *</Label>
            <Textarea
              placeholder="Jelaskan detail biaya atau rugi..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Jumlah (Rp) *</Label>
              <NumberInput
                value={form.amount}
                onChange={(value) => setForm({ ...form, amount: value })}
                placeholder="0"
              />
            </div>
            <div>
              <Label>Jumlah Unit Hilang</Label>
              <NumberInput
                value={form.quantity_loss}
                onChange={(value) => setForm({ ...form, quantity_loss: value })}
                placeholder="0"
                decimal={false}
              />
            </div>
          </div>

          <div>
            <Label>Referensi Dokumen</Label>
            <Input
              placeholder="No. PO, Batch Number, dll"
              value={form.document_reference}
              onChange={(e) => setForm({ ...form, document_reference: e.target.value })}
            />
          </div>

          <div>
            <Label>Catatan</Label>
            <Textarea
              placeholder="Catatan tambahan..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
            />
          </div>

          <div>
            <Label>URL Bukti/Foto</Label>
            <Input
              type="url"
              placeholder="https://..."
              value={form.attachment_url}
              onChange={(e) => setForm({ ...form, attachment_url: e.target.value })}
            />
          </div>
        </div>
      </FormModal>
    </div>
  );
}
