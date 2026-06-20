# Lead Tracker CRM

Lead Tracker CRM adalah sistem pengurusan perhubungan pelanggan (CRM) berasaskan web yang ringkas, pantas, dan mesra peranti mudah alih (mobile-first). Ia direka khas untuk ejen hartanah, pembekal perkhidmatan pembangunan laman web/landing page, pekerja bebas (freelancer), dan pemilik perniagaan kecil untuk merekod prospek (leads) dari pelbagai saluran pemasaran, mengurus temujanji follow-up, serta melihat analitis kadar tukaran jualan (conversion rate).

---

## ⚡ Ciri-ciri Utama

1. **Dashboard Utama**: Ringkasan statistik harian & bulanan (Leads Baru, Tugasan Hari Ini, Deal Won, Deal Lost, Kadar Tukaran), senarai leads terkini dan peringatan tugasan.
2. **Modul Pengurusan Leads**: Carian pantas, penapis (niche, status, source), tambah/kemaskini/padam data prospek.
3. **Profil Terperinci Lead**: Rekod data perniagaan, nota tambahan interaksi, garis masa aktiviti (activity timeline) automatik, dan jadual tugasan.
4. **Tindakan Pantas (Quick Actions)**: Terus hantar WhatsApp (dengan template teks tersusun) atau buat panggilan telefon.
5. **Modul Follow-Up**: Paparan senarai (List View) berkumpulan (Tunggakan, Mendatang, Selesai) dan paparan Kalendar interaktif.
6. **Graf & Analitis**: Analisis visual (Leads by Source, Niche, Status, Monthly Trend) menggunakan Chart.js serta jadual saluran berprestasi tinggi.
7. **Pangkalan Data Hibrid**: Berjalan secara local menggunakan LocalStorage secara automatik. Boleh dihubungkan ke Google Sheets melalui Google Apps Script untuk sandaran awan (cloud sync).
8. **Pasang sebagai PWA**: Sedia dipasang terus pada telefon pintar/komputer riba (Progressive Web App) untuk akses offline.

---

## 🚀 Cara Menjalankan Aplikasi

Aplikasi ini dibina sebagai **Single Page Application (SPA)** menggunakan Vanilla JS & Tailwind CSS. Tiada langkah kompilasi (npm build) diperlukan!

### Langkah 1: Jalankan Pelayan Tempatan (Local Web Server)
Untuk memastikan PWA (Service Worker) berfungsi dengan baik, anda digalakkan menjalankan aplikasi melalui local web server. Anda boleh gunakan mana-mana kaedah berikut:

* **VS Code Live Server**: Klik kanan pada `index.html` dan pilih *Open with Live Server*.
* **Python (jika terpasang)**: Jalankan arahan ini di terminal anda:
  ```bash
  python -m http.server 8000
  ```
  Kemudian buka pelayar web dan layari `http://localhost:8000`.
* **Nodejs (serve)**:
  ```bash
  npx serve
  ```

Aplikasi akan dimuatkan secara automatik bersama **Mock Data (Prospek Contoh)** untuk tujuan ujian.

---

## 📊 Konfigurasi Integrasi Google Sheets (Backend)

Anda boleh menyimpan data CRM ini terus ke dalam Google Sheets secara automatik. Data akan diselaraskan secara dua hala (Sync).

### Langkah 1: Sediakan Spreadsheet & Apps Script
1. Buka [Google Sheets](https://sheets.google.com) dan cipta spreadsheet baharu. Namakannya contohnya `Lead Tracker CRM DB`.
2. Pada menu atas, klik **Extensions** (Pelanjutan) > **Apps Script**.
3. Padam sebarang kod sedia ada di dalam editor `Code.gs`.
4. Buka fail [Code.js](file:///C:/Users/Zaim/.gemini/antigravity/scratch/lead-tracker-crm/backend/Code.js) dalam folder projek ini, salin kesemua kodnya, dan tampal ke dalam editor Apps Script.
5. *(Opsional)* Jika anda mahu keselamatan tambahan, isi pembolehubah `var API_PASSCODE = "pin_pilihan_anda";` di baris teratas kod. Jika tidak mahu, biarkan kosong.
6. Klik butang **Save** (ikon disket).

### Langkah 2: Deploy sebagai Web App
1. Klik butang **Deploy** (Penyebaran) di bahagian atas kanan > pilih **New Deployment** (Penyebaran Baharu).
2. Klik ikon gear (jenis penyebaran) > pilih **Web app** (Apl web).
3. Konfigurasikan tetapan berikut:
   * **Description**: `Lead Tracker CRM API`
   * **Execute as**: **Me (emel_anda@gmail.com)**
   * **Who has access**: **Anyone** *(Penting: Pilih 'Anyone' supaya aplikasi frontend CRM boleh menghantar data)*
4. Klik **Deploy**.
5. Google akan meminta kebenaran (Authorization). Klik **Authorize access**, pilih akaun Google anda, klik **Advanced** (Lanjutan), kemudian klik **Go to Lead Tracker CRM DB (unsafe)**, dan akhir sekali klik **Allow**.
6. Salin **Web App URL** yang diberikan (URL kelihatan seperti ini: `https://script.google.com/macros/s/.../exec`).

### Langkah 3: Sambungkan ke Frontend CRM
1. Buka aplikasi **Lead Tracker CRM** di pelayar web anda.
2. Pergi ke tab **Settings** (ikon gear di sidebar / menu bawah).
3. Tampal URL yang disalin tadi ke dalam ruangan **Google Apps Script Web App URL**.
4. Jika anda menetapkan passcode di Langkah 1(5), masukkan passcode tersebut di ruangan **Passcode API**.
5. Klik **Uji Sambungan** untuk mengesahkan sambungan berjaya.
6. Klik **Sync Data Sekarang** untuk memuat naik data local sedia ada anda ke dalam Google Sheets buat kali pertama. Google Sheets anda akan membina tab `leads`, `followups`, `activities`, dan `settings` secara automatik!

---

## 🔒 Keselamatan Portal (Local Lock PIN)
Sekiranya anda mahu menyekat orang lain daripada membuka CRM ini dari pelayar web komputer/telefon anda, pergi ke tab **Settings** > **Keselamatan Portal (Lock PIN)**. Masukkan PIN keselamatan anda (contohnya `1234` atau sebarang kata laluan). Portal akan dikunci dan meminta log masuk setiap kali ia dibuka semula.

---

## 💾 Eksport & Import Manual
Anda juga boleh membuat sandaran secara manual tanpa Google Sheets:
* Pergi ke **Settings** > **Sistem & Pangkalan Data**.
* Klik **Eksport JSON** untuk memuat turun fail sandaran `.json`.
* Klik **Import JSON** untuk memulihkan data anda dari fail sandaran pada peranti baharu.
