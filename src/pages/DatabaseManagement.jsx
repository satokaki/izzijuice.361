LAB PRO v3.6.1
PATCH: FRESH RESTORE VS RESUME SESSION
DATE: 13 AUGUST 2026

ROOT CAUSE
==========
Bug berada di frontend DatabaseManagement.jsx.

Saat modal "Restore dari Backup File" dibuka, function findResumableSession()
mencari semua DatabaseRestoreSession dengan status:

READY
RUNNING
PAUSED
VERIFYING

Kemudian code selalu memilih session aktif pertama:

const active =
  activeRows.find((row) => row.id === stored?.id) ||
  activeRows[0] ||
  null;

Selama resumableSession ada:
1. input file disabled dengan !!resumableSession
2. onPickFile() langsung menolak
3. doFileRestore() langsung menolak

Akibatnya session restore lama yang tertinggal selalu memaksa user
"Lanjutkan Restore", walaupun user ingin mulai restore fresh dari file baru.

AUDIT BACKEND
=============
databaseRestore.jsx:
NO CHANGE REQUIRED.

databaseRestoreBatch.jsx:
NO CHANGE REQUIRED.

Restore batch sudah bekerja berdasarkan session_id eksplisit.
Bug bukan karena databaseRestoreBatch otomatis memilih session lama.

MINIMAL PATCH LOCATION
======================
src/pages/DatabaseManagement.jsx
(atau path aktual page Database Management pada project Base44)

PATCH
=====

1. Tambahkan state setelah resumeChecking:

const [abandoningSession, setAbandoningSession] = useState(false);


2. Tambahkan function ini setelah clearActiveRestoreSession():

const abandonRestoreSession = useCallback(async () => {
  if (!resumableSession?.id) {
    clearActiveRestoreSession();
    return;
  }

  const confirmed = window.confirm(
    `Buang restore session lama ${resumableSession.session_code || ''}?\n\n` +
    `Session lama akan ditandai ABANDONED dan TIDAK dilanjutkan.\n` +
    `Setelah itu Anda dapat memilih file backup baru dan memulai restore fresh.\n\n` +
    `Ini tidak menghapus file backup dan tidak menjalankan proses restore.`
  );

  if (!confirmed) return;

  setAbandoningSession(true);

  try {
    await base44.entities.DatabaseRestoreSession.update(
      resumableSession.id,
      {
        status: 'ABANDONED',
        error_message: 'Abandoned by administrator to start fresh restore.',
        last_checkpoint_at: new Date().toISOString(),
      }
    );

    clearActiveRestoreSession();
    resetFileState();

    toast({
      title: 'Restore session lama dibuang',
      description: 'Silakan pilih file backup untuk memulai restore fresh.',
    });
  } catch (error) {
    toast({
      variant: 'destructive',
      title: 'Gagal membuang restore session lama',
      description:
        error?.response?.data?.error ||
        error?.message ||
        'Terjadi kesalahan',
    });
  } finally {
    setAbandoningSession(false);
  }
}, [
  resumableSession,
  clearActiveRestoreSession,
  toast,
]);


CATATAN:
Jika linter mengeluh resetFileState belum stabil karena function biasa,
ubah resetFileState menjadi useCallback:

const resetFileState = useCallback(() => {
  setUploadedFile(null);
  setPreview(null);
  setValidateError('');
  setNeedsPassword(false);
  setFilePassword('');
  setFilePhrase('');
  setFileAck(false);
  setRestoreProgress(null);

  if (fileInputRef.current) {
    fileInputRef.current.value = '';
  }
}, []);

Lalu dependency abandonRestoreSession tambahkan resetFileState.


3. Ganti blok tombol "Lanjutkan Restore" pada banner resumableSession.

SEBELUM:

<Button
  className="mt-3"
  onClick={() =>
    runRestoreSession(resumableSession, {
      isResume: true,
    })
  }
  disabled={busy || resumeChecking}
>
  {resumeChecking
    ? 'Memeriksa session...'
    : 'Lanjutkan Restore'}
</Button>


MENJADI:

<div className="mt-3 flex flex-wrap gap-2">
  <Button
    onClick={() =>
      runRestoreSession(resumableSession, {
        isResume: true,
      })
    }
    disabled={
      busy ||
      resumeChecking ||
      abandoningSession
    }
  >
    {resumeChecking
      ? 'Memeriksa session...'
      : 'Lanjutkan Restore'}
  </Button>

  <Button
    type="button"
    variant="outline"
    onClick={abandonRestoreSession}
    disabled={
      busy ||
      resumeChecking ||
      abandoningSession
    }
  >
    {abandoningSession
      ? 'Membuang session...'
      : 'Restore Fresh'}
  </Button>
</div>


4. Ubah pesan banner agar pilihan jelas.

SEBELUM:
Restore belum selesai ditemukan

MENJADI:
Restore sebelumnya belum selesai

Tambahkan teks:
"Pilih Lanjutkan Restore untuk meneruskan checkpoint lama,
atau Restore Fresh untuk membuang session lama dan memilih file baru."


EXPECTED RESULT
===============
CASE A — user memang ingin resume:
Lanjutkan Restore
-> session lama tetap dipakai
-> checkpoint tetap aman

CASE B — user ingin restore fresh:
Restore Fresh
-> session lama status ABANDONED
-> localStorage active restore dibersihkan
-> picker file aktif kembali
-> pilih JSON baru
-> databaseRestoreFromFile membuat session RST baru
-> restore mulai dari awal

IMPORTANT SAFETY
================
Jangan DELETE DatabaseRestoreSession lama.
Gunakan status ABANDONED agar audit trail tetap ada.

Jangan ubah databaseRestoreBatch.jsx.
Jangan reset checkpoint session lama menjadi offset 0 lalu reuse session.
Fresh restore HARUS membuat session baru.

CLASSIFICATION
==============
RESTORE-CONTROL PATCH.
Tidak mengubah StockLedger / StockBalance / transaksi operasional secara langsung,
tetapi mengubah status DatabaseRestoreSession dan mengontrol destructive restore flow.
Uji di DEV v3.6.1 sebelum dibawa ke environment lain.
