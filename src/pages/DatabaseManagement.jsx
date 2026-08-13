import React, { useEffect, useState, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import FormModal from '@/components/FormModal';
import {
  Save,
  RotateCcw,
  Upload,
  ShieldAlert,
  Trash2,
  Download,
  Lock,
  FileUp,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  APP_ENVIRONMENT,
  IS_PRODUCTION,
  RESET_CONFIRM_PHRASE,
  RESTORE_CONFIRM_PHRASE,
  MAX_RESTORE_FILE_SIZE,
} from '@/lib/dbEnv';

// Fetch a signed URL as a blob and force a browser download (never renders inline).
async function triggerDownload(signedUrl, fileName) {
  const res = await fetch(signedUrl);
  if (!res.ok) throw new Error('Gagal mengunduh file (status ' + res.status + ')');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'LABPRO_BACKUP.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function DatabaseManagement() {
  const { toast } = useToast();
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Save modal
  const [saveOpen, setSaveOpen] = useState(false);
  const [bkName, setBkName] = useState('');
  const [bkNotes, setBkNotes] = useState('');
  const [bkType, setBkType] = useState('operational');
  const [bkEncrypt, setBkEncrypt] = useState(false);
  const [bkPassword, setBkPassword] = useState('');
  const [lastBackup, setLastBackup] = useState(null); // { code, fileName, size }

  // Reset modal
  const [resetOpen, setResetOpen] = useState(false);
  const [resetMode, setResetMode] = useState('transaction');
  const [resetSequences, setResetSequences] = useState(true);
  const [skipBackup, setSkipBackup] = useState(false);
  const [resetPhrase, setResetPhrase] = useState('');
  const [resetAck, setResetAck] = useState(false);
  const [resetPassword, setResetPassword] = useState('');

  // Stored-backup restore modal
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreId, setRestoreId] = useState('');
  const [restoreMode, setRestoreMode] = useState('operational');
  const [restorePhrase, setRestorePhrase] = useState('');
  const [restoreAck, setRestoreAck] = useState(false);

  // File restore modal
  const [fileOpen, setFileOpen] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null); // { file_uri, file_name, file_size }
  const [preview, setPreview] = useState(null);
  const [validateError, setValidateError] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [filePassword, setFilePassword] = useState('');
  const [fileMode, setFileMode] = useState('operational');
  const [filePhrase, setFilePhrase] = useState('');
  const [fileAck, setFileAck] = useState(false);
  const fileInputRef = useRef(null);

  // Batch restore progress
  const [restoreProgress, setRestoreProgress] = useState(null);
  const [restoreRunning, setRestoreRunning] = useState(false);

  const downloadAllowed = true;

  const loadBackups = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await base44.entities.DatabaseBackup.list('-created_at', 200);
      setBackups(rows || []);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Gagal memuat backup', description: e.message });
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadBackups(); }, [loadBackups]);

  const fmtSize = (b) => {
    if (!b) return '-';
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(2) + ' MB';
  };
  const fmtDate = (d) => (d ? new Date(d).toLocaleString('id-ID') : '-');
  const statusColor = {
    COMPLETED: 'bg-emerald-100 text-emerald-700',
    CREATING: 'bg-amber-100 text-amber-700',
    FAILED: 'bg-red-100 text-red-700',
    DELETED: 'bg-slate-100 text-slate-500',
  };
  const completedBackups = backups.filter((b) => b.status === 'COMPLETED');

  const backupTypeLabel = (type) =>
    type === 'data_only' ? 'Data Only' : type === 'full' ? 'Full' : 'Operational';

  const doSave = async () => {
    if (bkEncrypt && !bkPassword) {
      toast({ variant: 'destructive', title: 'Masukkan password enkripsi' });
      return;
    }
    setBusy(true);
    try {
      const res = await base44.functions.invoke('databaseBackup', {
        name: bkName,
        notes: bkNotes,
        backup_type: bkType,
        encrypt: bkEncrypt,
        password: bkEncrypt ? bkPassword : undefined,
      });
      const backup = res.data?.backup;
      toast({ title: 'Backup berhasil dibuat', description: backup?.backup_code });
      setLastBackup({
        code: backup?.backup_code,
        fileName: backup?.file_name,
        size: backup?.file_size,
      });
      try {
        const dl = await base44.functions.invoke('databaseDownloadBackup', { backup_id: backup.id });
        await triggerDownload(dl.data.signed_url, dl.data.file_name);
        toast({ title: 'File terunduh', description: dl.data.file_name });
      } catch (e) {
        toast({
          variant: 'destructive',
          title: 'Gagal mengunduh',
          description: e.response?.data?.error || e.message,
        });
      }
      loadBackups();
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Backup gagal',
        description: e.response?.data?.error || e.message,
      });
    }
    setBusy(false);
  };

  const downloadBackup = async (b) => {
    setBusy(true);
    try {
      const dl = await base44.functions.invoke('databaseDownloadBackup', { backup_id: b.id });
      await triggerDownload(dl.data.signed_url, dl.data.file_name);
      toast({ title: 'File terunduh', description: dl.data.file_name });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Gagal mengunduh',
        description: e.response?.data?.error || e.message,
      });
    }
    setBusy(false);
  };

  const reDownloadLast = async () => {
    if (!lastBackup) return;
    const rec = backups.find((b) => b.backup_code === lastBackup.code);
    if (rec) await downloadBackup(rec);
  };

  const doReset = async () => {
    if (resetPhrase !== RESET_CONFIRM_PHRASE) {
      toast({ variant: 'destructive', title: 'Kalimat konfirmasi belum sesuai' });
      return;
    }
    if (!resetAck) {
      toast({ variant: 'destructive', title: 'Centang pemahaman risiko' });
      return;
    }
    if (!resetPassword) {
      toast({ variant: 'destructive', title: 'Masukkan password' });
      return;
    }
    setBusy(true);
    try {
      const res = await base44.functions.invoke('databaseReset', {
        mode: resetMode,
        resetSequences,
        skipBackup,
        confirm: resetPhrase,
      });
      toast({
        title: 'Reset selesai',
        description: `Mode ${resetMode} • ${res.data?.sequencesReset || 0} sequence direset`,
      });
      setResetOpen(false);
      setResetPhrase('');
      setResetAck(false);
      setResetPassword('');
      loadBackups();
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Reset gagal',
        description: e.response?.data?.error || e.message,
      });
    }
    setBusy(false);
  };

  const doRestore = async () => {
    if (!restoreId) {
      toast({ variant: 'destructive', title: 'Pilih backup' });
      return;
    }
    if (restorePhrase !== RESTORE_CONFIRM_PHRASE) {
      toast({ variant: 'destructive', title: 'Kalimat konfirmasi belum sesuai' });
      return;
    }
    if (!restoreAck) {
      toast({ variant: 'destructive', title: 'Centang pemahaman risiko' });
      return;
    }
    setBusy(true);
    try {
      const res = await base44.functions.invoke('databaseRestore', {
        backup_id: restoreId,
        mode: restoreMode,
        confirm: restorePhrase,
        autoBackup: true,
      });
      toast({ title: 'Restore selesai', description: res.data?.backup_code });
      setRestoreOpen(false);
      setRestorePhrase('');
      setRestoreAck(false);
      setRestoreId('');
      loadBackups();
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Restore gagal',
        description: e.response?.data?.error || e.message,
      });
    }
    setBusy(false);
  };

  const resetFileState = useCallback(() => {
    setUploadedFile(null);
    setPreview(null);
    setValidateError('');
    setNeedsPassword(false);
    setFilePassword('');
    setFilePhrase('');
    setFileAck(false);
    setRestoreProgress(null);
    setRestoreRunning(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_RESTORE_FILE_SIZE) {
      toast({
        variant: 'destructive',
        title: 'File terlalu besar',
        description: `Maksimum ${MAX_RESTORE_FILE_SIZE / 1048576} MB`,
      });
      return;
    }
    setBusy(true);
    resetFileState();
    try {
      const up = await base44.integrations.Core.UploadPrivateFile({ file });
      setUploadedFile({ file_uri: up.file_uri, file_name: file.name, file_size: file.size });
      await validateFile(up.file_uri, file.name, file.size, undefined);
    } catch (e) {
      setValidateError(e.response?.data?.error || e.message || 'Gagal mengupload file');
    }
    setBusy(false);
  };

  const validateFile = async (file_uri, file_name, file_size, password) => {
    setValidateError('');
    setPreview(null);
    setNeedsPassword(false);
    try {
      const res = await base44.functions.invoke('databaseValidateRestoreFile', {
        file_uri,
        file_name,
        file_size,
        password,
      });
      setPreview(res.data?.preview);
      setNeedsPassword(false);
    } catch (e) {
      const data = e.response?.data;
      if (data?.needsPassword) {
        setNeedsPassword(true);
        setValidateError(data.error || 'File terenkripsi, masukkan password');
      } else {
        setValidateError(data?.error || e.message || 'Validasi gagal');
        setNeedsPassword(false);
      }
    }
  };

  const revalidateWithPassword = async () => {
    if (!uploadedFile || !filePassword) {
      toast({ variant: 'destructive', title: 'Masukkan password' });
      return;
    }
    setBusy(true);
    await validateFile(uploadedFile.file_uri, uploadedFile.file_name, uploadedFile.file_size, filePassword);
    setBusy(false);
  };

  const doFileRestore = async () => {
    if (!uploadedFile) {
      toast({ variant: 'destructive', title: 'Pilih file backup' });
      return;
    }
    if (!preview) {
      toast({ variant: 'destructive', title: 'File belum tervalidasi' });
      return;
    }
    if (filePhrase !== RESTORE_CONFIRM_PHRASE) {
      toast({ variant: 'destructive', title: 'Kalimat konfirmasi belum sesuai' });
      return;
    }
    if (!fileAck) {
      toast({ variant: 'destructive', title: 'Centang pemahaman risiko' });
      return;
    }

    // Batch Restore V1 belum mendukung file terenkripsi lintas request.
    if (preview?.encrypted || needsPassword) {
      toast({
        variant: 'destructive',
        title: 'Batch Restore belum mendukung file terenkripsi',
        description: 'Untuk pengujian Restore Batch V1 gunakan backup tanpa enkripsi.',
      });
      return;
    }

    setBusy(true);
    setRestoreRunning(true);

    setRestoreProgress({
      status: 'PREPARING',
      phase: 'PREPARE',
      percent: 0,
      entity: '',
      fields: [],
      batch: 0,
      totalBatches: 0,
      batchFrom: 0,
      batchTo: 0,
      entityProcessed: 0,
      entityRecords: 0,
      totalProcessed: 0,
      totalRecords: preview?.recordCount || 0,
      message: 'Memvalidasi backup dan membuat restore session...',
    });

    let prepare;

    try {
      // STEP 1 — PREPARE RESTORE SESSION
      const prepareRes = await base44.functions.invoke('databaseRestoreFromFile', {
        file_uri: uploadedFile.file_uri,
        file_name: uploadedFile.file_name,
        mode: fileMode,
        confirm: filePhrase,
        autoBackup: true,
        password: undefined,
      });

      prepare = prepareRes?.data || {};

      if (!prepare.ok || !prepare.session_id) {
        throw new Error('Restore session gagal dibuat.');
      }

      setRestoreProgress({
        status: prepare.status || 'READY',
        phase: 'PREPARE',
        percent: 0,
        entity: '',
        fields: [],
        batch: 0,
        totalBatches: 0,
        batchFrom: 0,
        batchTo: 0,
        entityProcessed: 0,
        entityRecords: 0,
        totalProcessed: Number(prepare.total_processed || 0),
        totalRecords: Number(prepare.total_records || 0),
        entityTotal: Number(prepare.entity_total || 0),
        entities: prepare.entities || [],
        sessionCode: prepare.session_code || '',
        backupCode: prepare.backup_code || '',
        message: 'Restore session siap. Memulai proses batch...',
      });

      // STEP 2 — PROCESS BATCH UNTIL COMPLETE
      let done = false;
      let safetyCounter = 0;
      const MAX_BATCH_CALLS = 20000;

      while (!done) {
        safetyCounter += 1;
        if (safetyCounter > MAX_BATCH_CALLS) {
          throw new Error('Restore dihentikan karena jumlah batch melebihi batas keamanan.');
        }

        const batchRes = await base44.functions.invoke('databaseRestoreBatch', {
          session_id: prepare.session_id,
        });

        const progress = batchRes?.data || {};

        if (progress.status === 'FAILED' || progress.ok === false) {
          const restoreError = new Error(
            progress.error || `Restore gagal pada ${progress.error_entity || 'entity tidak diketahui'}`
          );
          restoreError.restoreData = progress;
          throw restoreError;
        }

        setRestoreProgress({
          status: progress.status || 'RUNNING',
          phase: progress.phase || 'RESTORE',
          percent: Number(progress.progress_percent || 0),
          operation: progress.operation || '',
          entity: progress.current_entity || progress.completed_entity || '',
          fields: Array.isArray(progress.current_fields) ? progress.current_fields : [],
          strategy: progress.strategy || '',
          batch: Number(progress.batch || 0),
          totalBatches: Number(progress.total_batches || 0),
          batchFrom: Number(progress.batch_from || 0),
          batchTo: Number(progress.batch_to || 0),
          batchWritten: Number(progress.batch_written || 0),
          entityProcessed: Number(progress.entity_processed || 0),
          entityRecords: Number(progress.entity_records || 0),
          totalProcessed: Number(progress.total_processed || 0),
          totalRecords: Number(progress.total_records || prepare.total_records || 0),
          deleteCompleted: Number(progress.delete_completed || 0),
          deleteTotal: Number(progress.delete_total || 0),
          sessionCode: prepare.session_code || '',
          backupCode: prepare.backup_code || '',
          message:
            progress.message ||
            (progress.phase === 'DELETE'
              ? `Menghapus data lama ${progress.current_entity || ''}...`
              : progress.phase === 'VERIFY'
                ? 'Memverifikasi hasil restore...'
                : progress.phase === 'COMPLETED'
                  ? 'Restore selesai 100%.'
                  : `Menulis ${progress.current_entity || 'data'}...`),
        });

        done = progress.done === true || progress.status === 'COMPLETED';

        if (!done) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      // SUCCESS
      setRestoreProgress((current) => ({
        ...current,
        status: 'COMPLETED',
        phase: 'COMPLETED',
        percent: 100,
        message: 'Restore selesai dan terverifikasi 100%.',
      }));

      toast({
        title: 'Restore dari file selesai',
        description: `${prepare.backup_code || ''} · 100% verified`,
      });

      await new Promise((resolve) => setTimeout(resolve, 800));

      setFileOpen(false);
      resetFileState();
      loadBackups();
    } catch (e) {
      console.error('[BATCH RESTORE FRONTEND ERROR]', e);

      const errorData = e?.response?.data || e?.restoreData || {};
      const errorMessage = errorData.error || e?.message || 'Restore gagal';

      setRestoreProgress((current) => ({
        ...(current || {}),
        status: 'FAILED',
        phase: current?.phase || 'RESTORE',
        message: errorMessage,
        errorEntity: errorData.error_entity || current?.entity || '',
        errorOffset: Number(errorData.error_offset || 0),
        errorFields: Array.isArray(errorData.error_fields) ? errorData.error_fields : [],
      }));

      toast({
        variant: 'destructive',
        title: 'Restore berhenti',
        description: errorData.error_entity
          ? `${errorData.error_entity} · ${errorMessage}`
          : errorMessage,
      });
    } finally {
      setBusy(false);
      setRestoreRunning(false);
    }
  };

  const closeFileModal = () => {
    if (restoreRunning) {
      toast({
        variant: 'destructive',
        title: 'Restore sedang berjalan',
        description: 'Tunggu proses restore selesai sebelum menutup jendela ini.',
      });
      return;
    }
    setFileOpen(false);
    resetFileState();
  };

  const deleteBackup = async (b) => {
    if (!window.confirm(`Hapus record backup ${b.backup_code}? (metadata ditandai DELETED; file storage tetap)`)) return;
    try {
      await base44.entities.DatabaseBackup.update(b.id, { status: 'DELETED' });
      loadBackups();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Gagal', description: e.message });
    }
  };

  const percentLabel = (p) => `${Math.max(0, Math.min(100, Number(p || 0)))}%`;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Database Management"
        description={`Environment: ${APP_ENVIRONMENT.toUpperCase()} • Khusus Administrator`}
      />

      {IS_PRODUCTION && (
        <div className="mb-4 bg-red-50 border border-red-300 rounded-lg px-4 py-3 text-[13px] text-red-700 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" /> Reset &amp; Restore dinonaktifkan pada
          environment Production. Backup &amp; Download tetap tersedia.
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-5">
        <Button onClick={() => { setLastBackup(null); setSaveOpen(true); }} disabled={busy} className="gap-2">
          <Save className="w-4 h-4" /> Buat Backup
        </Button>
        <Button
          variant="outline"
          onClick={() => { resetFileState(); setFileOpen(true); }}
          disabled={busy || IS_PRODUCTION}
          className="gap-2"
        >
          <FileUp className="w-4 h-4" /> Restore dari File
        </Button>
        <Button
          variant="outline"
          onClick={() => setRestoreOpen(true)}
          disabled={busy || IS_PRODUCTION}
          className="gap-2"
        >
          <Upload className="w-4 h-4" /> Restore Backup Tersimpan
        </Button>
        <Button
          variant="destructive"
          onClick={() => setResetOpen(true)}
          disabled={busy || IS_PRODUCTION}
          className="gap-2"
        >
          <RotateCcw className="w-4 h-4" /> Reset Database
        </Button>
      </div>

      {lastBackup && (
        <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <div>
              <div className="font-semibold">Backup terakhir berhasil</div>
              <div>{lastBackup.code} · {lastBackup.fileName} · {fmtSize(lastBackup.size)}</div>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={reDownloadLast} disabled={busy} className="gap-2">
            <Download className="w-4 h-4" /> Download lagi
          </Button>
        </div>
      )}

      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b font-semibold text-sm">Riwayat Backup</div>
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Memuat backup...</div>
        ) : backups.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">Belum ada backup.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3">Kode / Nama</th>
                  <th className="text-left px-4 py-3">Tipe</th>
                  <th className="text-left px-4 py-3">Dibuat</th>
                  <th className="text-left px-4 py-3">Ukuran</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {backups.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{b.backup_code || '-'}</div>
                      <div className="text-xs text-slate-500">{b.name || b.file_name || '-'}</div>
                    </td>
                    <td className="px-4 py-3">{backupTypeLabel(b.backup_type)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDate(b.created_at)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmtSize(b.file_size)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor[b.status] || 'bg-slate-100 text-slate-600'}`}>
                        {b.status || '-'}
                      </span>
                      {b.encrypted && <Lock className="inline w-3 h-3 ml-1" />}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Download"
                          disabled={busy || b.status !== 'COMPLETED' || !downloadAllowed}
                          onClick={() => downloadBackup(b)}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Restore"
                          disabled={busy || b.status !== 'COMPLETED' || IS_PRODUCTION}
                          onClick={() => { setRestoreId(b.id); setRestoreOpen(true); }}
                        >
                          <Upload className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Hapus"
                          disabled={busy}
                          onClick={() => deleteBackup(b)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SAVE MODAL */}
      <FormModal
        open={saveOpen}
        onClose={() => !busy && setSaveOpen(false)}
        title={lastBackup ? 'Backup Berhasil' : 'Buat Backup Database'}
        submitLabel={lastBackup ? 'Selesai' : 'Buat & Download'}
        submitting={busy}
        onSubmit={lastBackup ? () => { setSaveOpen(false); setLastBackup(null); setBkName(''); setBkNotes(''); setBkEncrypt(false); setBkPassword(''); } : doSave}
        size="md"
      >
        {lastBackup ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-semibold text-[14px]">Backup berhasil dibuat</span>
            </div>
            <div className="bg-muted/40 rounded p-3 text-[12.5px] space-y-1">
              <div><span className="text-muted-foreground">Backup:</span> <span className="font-mono">{lastBackup.code}</span></div>
              <div><span className="text-muted-foreground">File:</span> <span className="font-mono break-all">{lastBackup.fileName}</span></div>
              <div><span className="text-muted-foreground">Ukuran:</span> {fmtSize(lastBackup.size)}</div>
            </div>
            <Button variant="outline" className="w-full" onClick={reDownloadLast}>
              <Download className="w-4 h-4" /> Download Lagi
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label>Nama Backup</Label>
              <Input value={bkName} onChange={(e) => setBkName(e.target.value)} placeholder="Opsional — otomatis jika kosong" />
            </div>
            <div>
              <Label>Catatan</Label>
              <Textarea value={bkNotes} onChange={(e) => setBkNotes(e.target.value)} rows={2} placeholder="Alasan backup..." />
            </div>
            <div>
              <Label>Jenis Backup</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
                <button type="button" onClick={() => setBkType('data_only')} className={`border rounded px-3 py-2 text-left text-[12px] ${bkType === 'data_only' ? 'border-primary bg-primary/5' : 'border-input'}`}>
                  <div className="font-semibold">Data Only</div>
                  <div className="text-muted-foreground text-[11px]">Master, resep, Product Mapping & konfigurasi. Tanpa transaksi, stok, batch dan user.</div>
                </button>
                <button type="button" onClick={() => setBkType('operational')} className={`border rounded px-3 py-2 text-left text-[12px] ${bkType === 'operational' ? 'border-primary bg-primary/5' : 'border-input'}`}>
                  <div className="font-semibold">Operational</div>
                  <div className="text-muted-foreground text-[11px]">Master, resep, transaksi, stok, HPP, batch. Tanpa user/auth.</div>
                </button>
                <button type="button" onClick={() => setBkType('full')} className={`border rounded px-3 py-2 text-left text-[12px] ${bkType === 'full' ? 'border-primary bg-primary/5' : 'border-input'}`}>
                  <div className="font-semibold">Full</div>
                  <div className="text-muted-foreground text-[11px]">Operational + data User (export-only, tidak di-restore).</div>
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between rounded border px-3 py-2">
              <div>
                <div className="text-[13px] font-medium flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> Encrypt Backup File</div>
                <div className="text-[11px] text-muted-foreground">Enkripsi AES-256. Password tidak disimpan.</div>
              </div>
              <Switch checked={bkEncrypt} onCheckedChange={setBkEncrypt} />
            </div>
            {bkEncrypt && (
              <div>
                <Label>Password Enkripsi</Label>
                <Input type="password" value={bkPassword} onChange={(e) => setBkPassword(e.target.value)} placeholder="Password untuk membuka file backup" />
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">Backup disimpan di private storage + langsung diunduh ke perangkat Anda. Checksum SHA-256 menjamin integritas.</p>
          </div>
        )}
      </FormModal>

      {/* RESET MODAL */}
      <FormModal
        open={resetOpen}
        onClose={() => !busy && setResetOpen(false)}
        title="Reset Development Data"
        submitLabel="Jalankan Reset"
        submitting={busy}
        onSubmit={doReset}
        size="md"
      >
        <div className="space-y-3">
          <div className="bg-red-50 border border-red-300 rounded px-3 py-2 text-[12px] text-red-700">
            ⚠ Proses ini menghapus data operasional dan transaksi secara permanen. Data pengguna, role, dan hak akses tetap dipertahankan.
          </div>
          <div>
            <Label>Mode Reset</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button type="button" onClick={() => setResetMode('transaction')} className={`border rounded px-3 py-2 text-left text-[12px] ${resetMode === 'transaction' ? 'border-primary bg-primary/5' : 'border-input'}`}>
                <div className="font-semibold">Transaksi Saja</div>
                <div className="text-muted-foreground text-[11px]">Hapus transaksi + stok. Master & resep tetap.</div>
              </button>
              <button type="button" onClick={() => setResetMode('full')} className={`border rounded px-3 py-2 text-left text-[12px] ${resetMode === 'full' ? 'border-primary bg-primary/5' : 'border-input'}`}>
                <div className="font-semibold">Penuh Operasional</div>
                <div className="text-muted-foreground text-[11px]">Hapus transaksi + master + resep + stok.</div>
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label>Reset nomor dokumen operasional</Label>
            <Switch checked={resetSequences} onCheckedChange={setResetSequences} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Lanjut tanpa backup</Label>
            <Switch checked={skipBackup} onCheckedChange={setSkipBackup} />
          </div>
          {!skipBackup && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              Disarankan buat backup terlebih dahulu (Save Database) sebelum reset.
            </p>
          )}
          <div>
            <Label>Password (re-authentication)</Label>
            <Input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="Masukkan password Anda" />
          </div>
          <div>
            <Label>Ketik kalimat konfirmasi</Label>
            <Input value={resetPhrase} onChange={(e) => setResetPhrase(e.target.value)} placeholder={RESET_CONFIRM_PHRASE} className="font-mono text-[12px]" />
          </div>
          <label className="flex items-start gap-2 text-[12px]">
            <input type="checkbox" checked={resetAck} onChange={(e) => setResetAck(e.target.checked)} className="mt-0.5" />
            Saya memahami bahwa data yang dihapus tidak dapat dipulihkan kecuali tersedia backup.
          </label>
        </div>
      </FormModal>

      {/* STORED-RESTORE MODAL */}
      <FormModal
        open={restoreOpen}
        onClose={() => !busy && setRestoreOpen(false)}
        title="Restore dari Backup Tersimpan"
        submitLabel="Jalankan Restore"
        submitting={busy}
        onSubmit={doRestore}
        size="md"
      >
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 text-[12px] text-amber-700">
            Restore akan mengganti data operasional saat ini dengan data dari backup. User & hak akses tetap dipertahankan. Sistem membuat auto-backup otomatis sebelum restore.
          </div>
          <div>
            <Label>Pilih Backup</Label>
            <select value={restoreId} onChange={(e) => setRestoreId(e.target.value)} className="w-full h-9 border rounded px-2 text-[13px] bg-transparent">
              <option value="">— Pilih —</option>
              {completedBackups.map((b) => (
                <option key={b.id} value={b.id}>{b.backup_code} — {fmtDate(b.created_at)}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Mode Restore</Label>
            <div className="text-[12px] text-muted-foreground mt-1">Operational — Master+resep+transaksi+stok. User tetap (platform-managed).</div>
          </div>
          <div>
            <Label>Ketik kalimat konfirmasi</Label>
            <Input value={restorePhrase} onChange={(e) => setRestorePhrase(e.target.value)} placeholder={RESTORE_CONFIRM_PHRASE} className="font-mono text-[12px]" />
          </div>
          <label className="flex items-start gap-2 text-[12px]">
            <input type="checkbox" checked={restoreAck} onChange={(e) => setRestoreAck(e.target.checked)} className="mt-0.5" />
            Saya memahami data saat ini akan ditimpa oleh backup.
          </label>
        </div>
      </FormModal>

      {/* FILE-RESTORE MODAL */}
      <FormModal
        open={fileOpen}
        onClose={closeFileModal}
        title="Restore from Backup File"
        submitLabel="Jalankan Restore"
        submitting={busy}
        onSubmit={doFileRestore}
        size="md"
      >
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 text-[12px] text-amber-700">
            Pilih file backup (.json) dari local drive. File divalidasi (manifest, checksum, schema) sebelum restore dijalankan.
          </div>

          <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={onPickFile} />
          <Button type="button" variant="outline" className="w-full" disabled={busy || restoreRunning} onClick={() => fileInputRef.current?.click()}>
            <FileUp className="w-4 h-4" /> {uploadedFile ? uploadedFile.file_name : 'Pilih File Backup (.json)'}
          </Button>
          {uploadedFile && <div className="text-[11px] text-muted-foreground">Ukuran: {fmtSize(uploadedFile.file_size)}</div>}

          {needsPassword && (
            <div className="space-y-1">
              <Label>Password File (terenkripsi)</Label>
              <div className="flex gap-2">
                <Input type="password" value={filePassword} onChange={(e) => setFilePassword(e.target.value)} placeholder="Password backup" disabled={restoreRunning} />
                <Button type="button" variant="secondary" onClick={revalidateWithPassword} disabled={busy || restoreRunning}>Validasi</Button>
              </div>
            </div>
          )}

          {validateError && (
            <div className="bg-red-50 border border-red-300 rounded px-3 py-2 text-[12px] text-red-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> <span>{validateError}</span>
            </div>
          )}

          {preview && (
            <div className="bg-emerald-50 border border-emerald-200 rounded p-3 space-y-1.5 text-[12px]">
              <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                <CheckCircle2 className="w-4 h-4" /> File tervalidasi
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                <div><span className="text-muted-foreground">Aplikasi:</span> {preview.application}</div>
                <div><span className="text-muted-foreground">Backup ID:</span> <span className="font-mono">{preview.backupId}</span></div>
                <div><span className="text-muted-foreground">Tanggal:</span> {fmtDate(preview.createdAt)}</div>
                <div><span className="text-muted-foreground">Dibuat oleh:</span> {preview.createdBy}</div>
                <div><span className="text-muted-foreground">Versi App:</span> {preview.appVersion}</div>
                <div><span className="text-muted-foreground">Schema:</span> {preview.schemaVersion} {preview.schemaOk ? '(kompatibel)' : <span className="text-red-600">(tidak kompatibel)</span>}</div>
                <div><span className="text-muted-foreground">Jenis:</span> {backupTypeLabel(preview.backupType)}</div>
                <div><span className="text-muted-foreground">Terenkripsi:</span> {preview.encrypted ? 'Ya' : 'Tidak'}</div>
                <div><span className="text-muted-foreground">Record:</span> {preview.recordCount}</div>
                <div><span className="text-muted-foreground">Checksum:</span> <span className="text-emerald-700">{preview.checksumStatus}</span></div>
                <div><span className="text-muted-foreground">Ukuran:</span> {fmtSize(preview.fileSize)}</div>
                <div><span className="text-muted-foreground">Environment asal:</span> {preview.environment}</div>
              </div>
            </div>
          )}

          {preview && !restoreRunning && (
            <>
              <div>
                <Label>Mode Restore</Label>
                <div className="text-[12px] text-muted-foreground mt-1">Operational — Master+resep+transaksi+stok. User tetap (platform-managed).</div>
              </div>
              <div>
                <Label>Ketik kalimat konfirmasi</Label>
                <Input value={filePhrase} onChange={(e) => setFilePhrase(e.target.value)} placeholder={RESTORE_CONFIRM_PHRASE} className="font-mono text-[12px]" />
              </div>
              <label className="flex items-start gap-2 text-[12px]">
                <input type="checkbox" checked={fileAck} onChange={(e) => setFileAck(e.target.checked)} className="mt-0.5" />
                Saya memahami data saat ini akan ditimpa oleh backup ini.
              </label>
            </>
          )}

          {restoreProgress && (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-500">{restoreProgress.phase || 'RESTORE'}</div>
                  <div className="font-semibold text-sm">{restoreProgress.message}</div>
                </div>
                <div className="text-lg font-bold tabular-nums">{percentLabel(restoreProgress.percent)}</div>
              </div>
              <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={`h-full transition-all ${restoreProgress.status === 'FAILED' ? 'bg-red-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.max(0, Math.min(100, Number(restoreProgress.percent || 0)))}%` }}
                />
              </div>
              {restoreProgress.entity && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500">Entity</span>
                    <div className="font-mono font-medium">{restoreProgress.entity}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Record</span>
                    <div className="font-mono font-medium">{restoreProgress.totalProcessed || 0} / {restoreProgress.totalRecords || 0}</div>
                  </div>
                </div>
              )}
              {Array.isArray(restoreProgress.fields) && restoreProgress.fields.length > 0 && (
                <div>
                  <div className="text-xs text-slate-500 mb-1">Field yang ditulis</div>
                  <div className="flex flex-wrap gap-1">
                    {restoreProgress.fields.map((field) => (
                      <span key={field} className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px]">{field}</span>
                    ))}
                  </div>
                </div>
              )}
              {restoreProgress.status === 'FAILED' && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-3 text-[11px] text-red-700">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div>{restoreProgress.message}</div>
                      {restoreProgress.errorEntity && <div>Entity: <span className="font-mono">{restoreProgress.errorEntity}</span></div>}
                      {restoreProgress.errorOffset ? <div>Offset: {restoreProgress.errorOffset}</div> : null}
                      {Array.isArray(restoreProgress.errorFields) && restoreProgress.errorFields.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {restoreProgress.errorFields.map((field) => (
                            <span key={field} className="px-2 py-0.5 rounded bg-red-100 font-mono text-[10px]">{field}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </FormModal>
    </div>
  );
}