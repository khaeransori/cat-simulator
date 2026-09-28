# Cat Simulator: Sebelum Mama Pulang

Game kucing nakal 3D kotak-kotak ala Roblox untuk anak. Mama pergi kerja dan pintunya lupa dikunci. Kamu jadi kucing yang kabur keliling kompleks, bikin kekacauan, lalu harus sudah pulang dan pura-pura tidur di sofa sebelum Mama pulang sore hari. Dimainkan dengan sentuhan di HP, bisa jalan tanpa internet, dan semuanya ada dalam satu file HTML.

**Main sekarang:** https://khaeransori.github.io/cat-simulator/

## Main di HP

1. Buka https://khaeransori.github.io/cat-simulator/ di Chrome (Android) atau Safari (iPhone).
2. Android: menu titik tiga › **Instal aplikasi** / **Tambahkan ke Layar utama**.
   iPhone: tombol Bagikan › **Tambah ke Layar Utama**.
3. Setelah itu game bisa dimainkan tanpa internet, dan progresnya (koin ikan, baju, koleksi) tersimpan di HP.

Alternatif tanpa hosting: unduh [cat-simulator.html](https://khaeransori.github.io/cat-simulator/cat-simulator.html) lalu buka di Chrome.

## Isi game

- **Satu hari = 3, 5, atau 8 menit** (atur di Pengaturan). Matahari turun terus; 45 detik terakhir musik makin cepat dan panah menunjuk ke sofa.
- **Pulang tepat waktu:** pura-pura tidur di sofa sebelum Mama pulang dapat bonus. Kalau telat, Mama memergoki kucing di luar (lucu, bukan kalah).
- **21 kenakalan di 5 area:**
  - Rumah: jatuhin gelas, jatuhin pot, tarik tisu, tidur di laptop, curi ikan goreng, cakar gorden.
  - Taman: jatuhin pot taman, gali taman bunga, kagetin merpati, curi bola anak-anak.
  - Jalan kompleks: bikin Bleki menggonggong, sobek koran Bu Siti, curi sandal, tidur di jok motor (alarm!), jatuhin pot tetangga.
  - Pasar Ikan: curi ikan, tumpahin ember, dorong keranjang tomat.
  - Atap tetangga: jatuhin jemuran, curi ikan asin, kagetin merpati atap.
- **Satu tombol aksi kontekstual:** ikon dan tulisannya berubah sesuai barang terdekat (Dorong, Curi, Tidur, Cakar, Gali, Tarik, Kagetin, Mancing, Ngobrol). Barang yang belum dinakali hari ini berkilau ✦.
- **Warga kompleks:** Bu Siti (nyapu, mengusir pakai sapu), Pak Ujang penjual ikan, Bu Tini penjual sayur, Dimas dan Putri yang main bola dan suka meluk kucing, Bleki si anjing di balik pagar. Orang yang melihat kenakalan akan kaget lalu mengusir, tapi tidak pernah menyakiti.
- **Lisa, kucing pemberi quest:** 6 quest berantai, termasuk mancing di kolam taman, lalu quest mancing harian.
  1. Mancing 3 ikan → pola belang + Pasar Ikan terbuka
  2. 3 kekacauan di taman → topi pesta
  3. Bawa ikan pasar ke Lisa → pola tuksedo + jalan ke atap terbuka
  4. 2 kenakalan di atap → mahkota
  5. Pancing Ikan Emas legendaris → bulu emas
  6. Hari sempurna (8 kenakalan + pulang tepat waktu) → jubah pahlawan
- **Mancing:** tunggu pelampung, tekan saat ada yang makan, lalu tekan lagi saat penanda di bagian hijau. Bisa dapat ikan kecil, ikan mas, lele, sepatu bekas, atau Ikan Emas.
- **Gaya Kucing:** nama sendiri, 10 warna bulu, 6 pola, 5 warna mata, topi, kacamata, kalung, dan punggung (ransel, sayap, jubah). Dibuka dengan koin ikan atau hadiah quest.
- **Buku Kenakalan** (koleksi kenakalan dan ikan) dan **peta** kompleks.
- **Bahasa Indonesia / English** bisa dipilih di Pengaturan.
- Musik dan efek suara dibuat langsung dengan WebAudio, tanpa file audio.

Kontrol HP: geser di kiri layar untuk jalan (joystick muncul di mana jempol menyentuh), geser di kanan untuk putar kamera, tombol bulat Lompat, Aksi, dan Meong. Di laptop: WASD/panah, Spasi lompat, E aksi, M meong, geser mouse untuk kamera, Esc jeda.

## Pengembangan

```bash
npm ci
npm run dev       # server pengembangan Vite
npm run build     # hasil di dist/
npm run serve     # buka http://localhost:8080 (versi PWA)
```

Hasil build:

| File | Kegunaan |
| --- | --- |
| `dist/cat-simulator.html` | Satu file offline, lengkap dengan font dan semua kode |
| `dist/pwa/` | Versi aplikasi (manifest, service worker, ikon) untuk di-hosting |
| `dist/cat-simulator-pwa.zip` | Isi `dist/pwa/` dalam bentuk zip |
| `dist/cat-simulator-artifact.html` | Versi untuk Claude Artifact |

### Tes

Butuh Chromium: `npx playwright install chromium`, lalu `npm run build`.

```bash
npm run test:smoke      # judul, pilih kucing, intro, jalan keluar rumah, jumlah draw call
npm run test:mischief   # 20 kenakalan satu per satu
npm run test:quests     # rantai quest Lisa sampai hari sempurna
npm run test:portrait   # layar portrait + joystick, kamera, dan tombol sentuh
```

### Struktur kode

| File | Isi |
| --- | --- |
| `src/main.ts` | Boot, warga kompleks, loop utama, kamera menu |
| `src/world/map.ts` | Seluruh kompleks: rumah, gang, rumah tetangga, taman + kolam, pasar ikan, atap |
| `src/world/builder.ts` | Penggabung blok (satu draw call untuk dunia statis) dan collider |
| `src/world/physics.ts` | Fisika kotak ringan: tabrakan, naik tangga, bantuan manjat tepian, raycast kamera |
| `src/entities/cat.ts` | Kontrol kucing dan kamera orang ketiga yang dekat |
| `src/entities/catModel.ts` | Model kucing kotak-kotak, pola bulu, aksesori, animasi |
| `src/entities/npc.ts` | Warga: patroli, melihat, kaget, mengusir |
| `src/entities/creatures.ts` | Bleki, merpati, Lisa, anak-anak dan bola |
| `src/game/mischief.ts` | Daftar kenakalan dan efeknya |
| `src/game/quests.ts` | Quest Lisa |
| `src/game/fishing.ts` | Mini game mancing |
| `src/game/day.ts` | Alur satu hari, cutscene Mama, panah petunjuk |
| `src/ui/` | HUD, menu, toko gaya, buku, peta, pengaturan |
| `src/cosmetics.ts` | Katalog bulu, pola, mata, dan aksesori |
| `src/i18n.ts` | Teks Indonesia dan Inggris |

## Deploy

Push ke `main` menjalankan `.github/workflows/pages.yml` yang build lalu deploy `dist/pwa/` ke GitHub Pages. Aktifkan sekali di **Settings › Pages › Source: GitHub Actions**.
